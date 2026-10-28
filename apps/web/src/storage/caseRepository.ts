// SPDX-License-Identifier: GPL-3.0-or-later

import { CorruptDataError, VaultLockedError } from '../crypto/errors';
import type { Keyring } from '../crypto/keyring';
import {
  type CasePayload,
  type CaseRecord,
  type ConsentEntry,
  generateCaseCode,
  parseCasePayload,
  type ScreeningEntry,
} from '../model/case';
import type { SaviaDatabase } from './db';
import { CaseNotFoundError, ConcurrentModificationError, ImmutableFieldError } from './errors';

/** Entrada pública para crear un caso; el código y las fechas los genera el repositorio. */
export interface NewCaseInput {
  /** Consentimiento obligatorio; no se persiste un caso sin él. */
  consent: ConsentEntry;
  /** `true` en datos de demostración y pruebas. */
  synthetic: boolean;
  /** Tamizajes iniciales; por defecto, ninguno. */
  screenings?: ScreeningEntry[];
}

/** Opciones de paginación del listado. */
export interface ListOptions {
  /** Tamaño de página; por defecto 20 y nunca superior a 100. */
  limit?: number;
  /** Desplazamiento desde el caso más reciente. */
  offset?: number;
}

/** Resultado paginado del listado. */
export interface ListResult {
  /** Casos descifrados de la página, del más reciente al más antiguo. */
  items: CaseRecord[];
  /** Identificadores de filas que no se pudieron descifrar o validar. */
  unreadableIds: string[];
}

/** Contrato del repositorio de casos. */
export interface CaseRepository {
  /** Crea y persiste un caso cifrado. */
  create(input: NewCaseInput): Promise<CaseRecord>;
  /** Devuelve el caso o `null` si no existe. */
  get(id: string): Promise<CaseRecord | null>;
  /** Lista una página de casos, del más reciente al más antiguo. */
  list(options?: ListOptions): Promise<ListResult>;
  /** Cuenta los casos sin descifrarlos. */
  count(): Promise<number>;
  /** Aplica un cambio optimista y conserva los campos inmutables. */
  update(id: string, updater: (current: CasePayload) => CasePayload): Promise<CaseRecord>;
}

/** Dependencias inyectadas; no hay singletons globales en esta capa. */
export interface CaseRepositoryDependencies {
  db: SaviaDatabase;
  keyring: Keyring;
}

/** Nombre de la tabla de casos; forma parte del AAD de cada registro. */
const CASES_TABLE = 'cases';

/** Límite por defecto de una página. */
const DEFAULT_LIST_LIMIT = 20;

/** Límite máximo de una página para no descifrar más de lo necesario. */
const MAX_LIST_LIMIT = 100;

/** Normaliza el tamaño de página. */
function normaliseLimit(limit: number | undefined): number {
  // Se usa el valor por defecto cuando no se pide un tamaño.
  const requested = limit ?? DEFAULT_LIST_LIMIT;

  // Un tamaño no entero o no positivo indica un error de programación.
  if (!Number.isInteger(requested) || requested < 1) {
    throw new RangeError('List limit must be a positive integer');
  }

  // El máximo evita que una llamada accidental descifre toda la tabla.
  return Math.min(requested, MAX_LIST_LIMIT);
}

/** Normaliza el desplazamiento. */
function normaliseOffset(offset: number | undefined): number {
  // Se empieza en el caso más reciente cuando no se pide un desplazamiento.
  const requested = offset ?? 0;

  // Un desplazamiento no entero o negativo indica un error de programación.
  if (!Number.isInteger(requested) || requested < 0) {
    throw new RangeError('List offset must be a non-negative integer');
  }

  return requested;
}

/** Construye el caso público a partir del contenido cifrado y los metadatos de la fila. */
function toCaseRecord(payload: CasePayload, id: string, updatedAt: number): CaseRecord {
  // `id` y `updatedAt` viven en la fila; el resto viene del contenido autenticado.
  return { ...payload, id, updatedAt };
}

/** Comprueba que dos consentimientos son iguales campo a campo. */
function sameConsent(left: ConsentEntry, right: ConsentEntry): boolean {
  // El consentimiento solo tiene dos campos y ambos deben permanecer inmutables.
  return left.textVersion === right.textVersion && left.timestamp === right.timestamp;
}

/**
 * Crea el repositorio de casos.
 *
 * La clave solo se obtiene con `keyring.withDataKey`, que lanza `VaultLockedError` si el almacén está
 * bloqueado. El repositorio nunca guarda la sesión ni la clave fuera de la operación en curso.
 */
export function createCaseRepository(deps: CaseRepositoryDependencies): CaseRepository {
  const { db, keyring } = deps;

  return {
    async create(input) {
      // Toda la operación pasa por la vista acotada de la DEK.
      return keyring.withDataKey(async (session) => {
        // El identificador de fila es un UUID aleatorio sin relación con la persona.
        const id = globalThis.crypto.randomUUID();

        // El código seudónimo y la fecha de creación se generan dentro del contenido cifrado.
        const payload: CasePayload = {
          code: generateCaseCode(),
          synthetic: input.synthetic,
          createdAt: new Date().toISOString(),
          consent: input.consent,
          screenings: input.screenings ?? [],
        };

        // Se valida antes de cifrar para no persistir un caso incompleto o inválido.
        const validated = parseCasePayload(payload);

        // El cifrado usa un IV nuevo y vincula la tabla y el id como AAD.
        const record = await session.encrypt(CASES_TABLE, id, validated);

        // La fila solo contiene los campos cifrados y los dos metadatos no sensibles.
        await db.cases.add(record);

        return toCaseRecord(validated, id, record.actualizadoEn);
      });
    },

    async get(id) {
      // La lectura también requiere el almacén desbloqueado.
      return keyring.withDataKey(async (session) => {
        // Se busca la fila por el id que también usa el AAD.
        const row = await db.cases.get(id);

        // La ausencia de fila no es un error de datos.
        if (row === undefined) {
          return null;
        }

        // Se descifra con el id pedido, no con el id de la fila.
        const payload = await session.decrypt<unknown>(CASES_TABLE, id, row);

        // El JSON descifrado se valida antes de entregarlo a la interfaz.
        return toCaseRecord(parseCasePayload(payload), id, row.actualizadoEn);
      });
    },

    async list(options) {
      // Toda la página se descifra dentro de una única operación con la DEK.
      return keyring.withDataKey(async (session) => {
        // Se normalizan los límites antes de consultar.
        const limit = normaliseLimit(options?.limit);
        const offset = normaliseOffset(options?.offset);

        // Solo se leen las filas de la página, nunca la tabla completa.
        const rows = await db.cases
          .orderBy('actualizadoEn')
          .reverse()
          .offset(offset)
          .limit(limit)
          .toArray();

        // Los elementos legibles y los identificadores ilegibles se separan.
        const items: CaseRecord[] = [];
        const unreadableIds: string[] = [];

        // Se descifra cada fila de la página por separado para aislar una fila corrupta.
        for (const row of rows) {
          try {
            const payload = await session.decrypt<unknown>(CASES_TABLE, row.id, row);
            items.push(toCaseRecord(parseCasePayload(payload), row.id, row.actualizadoEn));
          } catch (error) {
            // Solo un dato corrupto se omite; un bloqueo u otro fallo deben propagarse.
            if (error instanceof CorruptDataError) {
              unreadableIds.push(row.id);
              continue;
            }

            throw error;
          }
        }

        return { items, unreadableIds };
      });
    },

    async count() {
      // No hace falta descifrar, pero se exige el mismo estado desbloqueado que las demás operaciones.
      if (keyring.getState() !== 'unlocked') {
        throw new VaultLockedError();
      }

      return db.cases.count();
    },

    async update(id, updater) {
      // La operación completa usa una vista acotada de la DEK.
      return keyring.withDataKey(async (session) => {
        // 1. Se lee y descifra fuera de cualquier transacción de IndexedDB.
        const row = await db.cases.get(id);
        if (row === undefined) {
          throw new CaseNotFoundError();
        }

        const current = parseCasePayload(await session.decrypt<unknown>(CASES_TABLE, id, row));

        // Se guarda una copia de los campos inmutables antes de llamar al actualizador.
        const originalCode = current.code;
        const originalCreatedAt = current.createdAt;
        const originalConsent = { ...current.consent };
        const previousUpdatedAt = row.actualizadoEn;

        // 2. Se aplica el cambio y se valida el resultado completo.
        const updated = parseCasePayload(updater(current));

        // 3. Código, fecha de creación y consentimiento no pueden cambiar.
        if (
          updated.code !== originalCode ||
          updated.createdAt !== originalCreatedAt ||
          !sameConsent(updated.consent, originalConsent)
        ) {
          throw new ImmutableFieldError();
        }

        // La marca de actualización siempre avanza, aunque el reloj retroceda o no cambie.
        const updatedAt = Math.max(Date.now(), previousUpdatedAt + 1);

        // 4. Se cifra con un IV nuevo antes de abrir la transacción.
        const encrypted = await session.encrypt(CASES_TABLE, id, updated);

        // `actualizadoEn` no está autenticado; se fija al valor monótono calculado.
        const nextRecord = { ...encrypted, actualizadoEn: updatedAt };

        // 5. La transacción solo compara y escribe; no contiene llamadas a WebCrypto.
        await db.transaction('rw', db.cases, async () => {
          // Se vuelve a leer la fila dentro de la transacción para detectar carreras.
          const currentRow = await db.cases.get(id);
          if (currentRow === undefined) {
            throw new CaseNotFoundError();
          }

          // Si otra escritura cambió la fila, se aborta para no perder ese cambio.
          if (currentRow.actualizadoEn !== previousUpdatedAt) {
            throw new ConcurrentModificationError();
          }

          await db.cases.put(nextRecord);
        });

        return toCaseRecord(updated, id, updatedAt);
      });
    },
  };
}
