// SPDX-License-Identifier: GPL-3.0-or-later

import {
  AES_KEY_LENGTH_BITS,
  CRYPTO_FORMAT_VERSION,
  DATA_KEY_ALGORITHM,
  KEK_ALGORITHM,
  LOCKOUT_DELAYS_MS,
  PBKDF2_ITERATIONS,
  PBKDF2_MIN_ITERATIONS,
  PIN_MIN_LENGTH,
} from './constants';
import {
  IncorrectPinError,
  InvalidPinError,
  TooManyAttemptsError,
  VaultAlreadyInitializedError,
  VaultLockedError,
  VaultNotInitializedError,
} from './errors';
import { deriveKek, generateSalt } from './kdf';
import { parseCryptoMetadata, type CryptoMetadata, type CryptoMetadataStore } from './metadata';
import { decryptRecord, encryptRecord, type EncryptedRecord } from './recordCipher';
import { getWebCrypto, toBufferSource } from './webcrypto';

/** Estados posibles del llavero. */
export type VaultState = 'uninitialized' | 'locked' | 'unlocked';

/** Opciones de construcción del llavero. */
export interface KeyringOptions {
  /** Persistencia de metadatos; en producción es el adaptador de Dexie. */
  store: CryptoMetadataStore;
  /** Iteraciones de PBKDF2 para almacenes nuevos; se puede reducir solo en pruebas. */
  iterations?: number;
  /** Iteraciones mínimas aceptadas al leer metadatos; se puede reducir solo en pruebas. */
  minimumIterations?: number;
  /** Reloj inyectable para probar esperas sin dormir el proceso. */
  now?: () => number;
}

/**
 * Vista acotada de la DEK para la capa de datos.
 *
 * No expone el `CryptoKey` y comprueba en cada operación que el almacén siga desbloqueado con la misma
 * clave. Así, una vista capturada por error no permite seguir cifrando después de `lock()`.
 */
export interface DataKeySession {
  /** Indica si la DEK activa es exportable; debe ser siempre `false` en producción. */
  readonly extractable: boolean;
  /** Cifra un registro con la DEK activa y el formato actual. */
  encrypt<T>(table: string, id: string, value: T): Promise<EncryptedRecord>;
  /** Descifra un registro con la DEK activa y el contexto esperado. */
  decrypt<T>(table: string, id: string, record: EncryptedRecord): Promise<T>;
}

/** API pública mínima del llavero. */
export interface Keyring {
  /** Carga el estado persistido sin solicitar el PIN. */
  load(): Promise<VaultState>;
  /** Crea el salt y la DEK, y deja el almacén desbloqueado. */
  initialize(pin: string): Promise<void>;
  /** Deriva la KEK y desenvuelve la DEK. */
  unlock(pin: string): Promise<void>;
  /** Elimina la DEK de memoria. */
  lock(): void;
  /** Re-envuelve la misma DEK con una KEK nueva. */
  changePin(currentPin: string, newPin: string): Promise<void>;
  /** Devuelve el estado actual sin tocar la persistencia. */
  getState(): VaultState;
  /** Ejecuta una operación con una vista acotada de la DEK mientras está desbloqueado. */
  withDataKey<T>(operation: (session: DataKeySession) => Promise<T>): Promise<T>;
}

/** Patrón de PIN: solo dígitos y longitud mínima. */
const PIN_PATTERN = new RegExp(`^\\d{${PIN_MIN_LENGTH},}$`);

/** Comprueba la política mínima del PIN. */
function assertValidPin(pin: string): void {
  // Se rechazan letras, símbolos y longitudes menores que la mínima.
  if (!PIN_PATTERN.test(pin)) {
    throw new InvalidPinError();
  }
}

/** Calcula la espera que corresponde a un número de fallos. */
function delayForFailures(failedAttempts: number): number {
  // El índice se limita al último tramo para mantener la espera máxima.
  const index = Math.min(failedAttempts - 1, LOCKOUT_DELAYS_MS.length - 1);

  // `noUncheckedIndexedAccess` obliga a cubrir el caso imposible de índice fuera de rango.
  return LOCKOUT_DELAYS_MS[index] ?? LOCKOUT_DELAYS_MS[LOCKOUT_DELAYS_MS.length - 1] ?? 0;
}

/** Implementación del llavero con la DEK en un campo privado no serializable. */
class KeyringImplementation implements Keyring {
  private readonly store: CryptoMetadataStore;
  private readonly iterations: number;
  private readonly minimumIterations: number;
  private readonly now: () => number;
  private metadata: CryptoMetadata | null = null;
  private dataKey: CryptoKey | null = null;
  private lockGeneration = 0;
  private operationQueue: Promise<void> = Promise.resolve();

  constructor(options: KeyringOptions) {
    // Se guarda el puerto de persistencia.
    this.store = options.store;

    // Las iteraciones se validan aquí para no guardar metadatos inválidos.
    const iterations = options.iterations ?? PBKDF2_ITERATIONS;
    const minimumIterations = options.minimumIterations ?? PBKDF2_MIN_ITERATIONS;
    if (
      !Number.isInteger(iterations) ||
      !Number.isInteger(minimumIterations) ||
      iterations < minimumIterations ||
      minimumIterations <= 0
    ) {
      throw new RangeError('PBKDF2 iterations must be a positive integer');
    }
    this.iterations = iterations;
    this.minimumIterations = minimumIterations;

    // El reloj se inyecta para poder probar las esperas de forma determinista.
    this.now = options.now ?? Date.now;
  }

  load(): Promise<VaultState> {
    // Las lecturas también se serializan con las operaciones que escriben metadatos.
    return this.runExclusive(() => this.loadMetadata());
  }

  async initialize(pin: string): Promise<void> {
    // Se comprueba la política del PIN antes de generar claves.
    assertValidPin(pin);

    // La generación se captura al llamar, no al empezar la tarea: un `lock()` posterior invalida la
    // operación incluso si todavía estaba esperando en la cola.
    const generation = this.lockGeneration;

    return this.runExclusive(async () => {
      // Se carga el estado para no sobrescribir un almacén existente.
      await this.loadMetadata();

      // Solo se permite inicializar una vez.
      if (this.metadata !== null) {
        throw new VaultAlreadyInitializedError();
      }

      // Se genera un salt nueva para esta instalación.
      const salt = generateSalt();

      // La DEK se genera extraíble solo para poder envolverla inmediatamente.
      const extractableDataKey = await getWebCrypto().subtle.generateKey(
        { name: DATA_KEY_ALGORITHM, length: AES_KEY_LENGTH_BITS },
        true,
        ['encrypt', 'decrypt'],
      );

      // La KEK se deriva del PIN y del salt.
      const kek = await deriveKek(pin, salt, this.iterations);

      // La DEK se envuelve con la KEK; solo se persiste el resultado envuelto.
      const wrappedDataKey = new Uint8Array(
        await getWebCrypto().subtle.wrapKey('raw', extractableDataKey, kek, KEK_ALGORITHM),
      );

      // Se vuelve a desenvolver como no extraíble para que sea la DEK activa.
      const dataKey = await getWebCrypto().subtle.unwrapKey(
        'raw',
        toBufferSource(wrappedDataKey),
        kek,
        KEK_ALGORITHM,
        { name: DATA_KEY_ALGORITHM, length: AES_KEY_LENGTH_BITS },
        false,
        ['encrypt', 'decrypt'],
      );

      // Se preparan los metadatos sin secretos en claro.
      const metadata: CryptoMetadata = {
        v: CRYPTO_FORMAT_VERSION,
        kdf: {
          alg: 'PBKDF2',
          hash: 'SHA-256',
          iterations: this.iterations,
          salt,
        },
        wrappedDataKey,
        failedAttempts: 0,
        lockedUntil: null,
      };

      // Si el llavero se bloqueó mientras se generaban las claves, no se persiste nada.
      this.assertGeneration(generation);

      // Se persisten los metadatos antes de publicar la DEK en memoria.
      await this.store.save(metadata);

      // Los metadatos existen aunque un bloqueo tardío impida publicar la clave.
      this.metadata = metadata;

      // Se comprueba de nuevo el bloqueo, que pudo ocurrir durante la escritura.
      this.assertGeneration(generation);

      // El almacén queda desbloqueado porque la usuaria acaba de crear el PIN.
      this.dataKey = dataKey;
    });
  }

  async unlock(pin: string): Promise<void> {
    // Se valida el formato antes de gastar tiempo en PBKDF2.
    assertValidPin(pin);

    // La generación se captura al llamar, no al empezar la tarea: un `lock()` posterior invalida la
    // operación incluso si todavía estaba esperando en la cola.
    const generation = this.lockGeneration;

    return this.runExclusive(async () => {
      // Se cargan los metadatos si aún no están en memoria.
      await this.loadMetadata();

      // Sin metadatos no existe una DEK que desenvolver.
      const metadata = this.metadata;
      if (metadata === null) {
        throw new VaultNotInitializedError();
      }

      // Se respeta la espera activa antes de aceptar otro intento.
      this.assertNotLocked(metadata);

      // La KEK se deriva con los parámetros persistidos, no con los actuales.
      const kek = await deriveKek(pin, metadata.kdf.salt, metadata.kdf.iterations);

      // Si el llavero se bloqueó durante PBKDF2, no se continúa con la clave derivada.
      this.assertGeneration(generation);

      let dataKey: CryptoKey;

      try {
        // Un PIN incorrecto hace fallar el desenvolvimiento de la DEK.
        dataKey = await getWebCrypto().subtle.unwrapKey(
          'raw',
          toBufferSource(metadata.wrappedDataKey),
          kek,
          KEK_ALGORITHM,
          { name: DATA_KEY_ALGORITHM, length: AES_KEY_LENGTH_BITS },
          false,
          ['encrypt', 'decrypt'],
        );
      } catch {
        // Un bloqueo durante el intento no debe contar como PIN incorrecto.
        this.assertGeneration(generation);

        // Se registra el fallo persistente y se muestra un error genérico.
        await this.registerFailure(metadata);
        throw new IncorrectPinError();
      }

      // Un bloqueo durante el desenvolvimiento invalida el resultado.
      this.assertGeneration(generation);

      // Al acertar se reinician los fallos y se elimina cualquier espera.
      const unlockedMetadata: CryptoMetadata = {
        ...metadata,
        failedAttempts: 0,
        lockedUntil: null,
      };

      // Se guarda el reinicio antes de publicar la DEK.
      await this.store.save(unlockedMetadata);

      // Los metadatos existen aunque un bloqueo tardío impida publicar la clave.
      this.metadata = unlockedMetadata;

      // Se comprueba de nuevo el bloqueo, que pudo ocurrir durante la escritura.
      this.assertGeneration(generation);

      // Se publica la DEK no extraíble y el estado desbloqueado.
      this.dataKey = dataKey;
    });
  }

  lock(): void {
    // Se invalida cualquier operación en curso que pudiera publicar una clave después del bloqueo.
    this.lockGeneration += 1;

    // Se elimina la única referencia a la DEK; WebCrypto no permite borrar sus bytes a demanda.
    this.dataKey = null;
  }

  async changePin(currentPin: string, newPin: string): Promise<void> {
    // El PIN actual debe tener un formato que pueda ser correcto.
    assertValidPin(currentPin);

    // El PIN nuevo debe cumplir la política antes de modificar nada.
    assertValidPin(newPin);

    // La generación se captura al llamar, no al empezar la tarea: un `lock()` posterior invalida la
    // operación incluso si todavía estaba esperando en la cola.
    const generation = this.lockGeneration;

    return this.runExclusive(async () => {
      // Se cargan los metadatos si aún no están en memoria.
      await this.loadMetadata();

      // Sin metadatos no hay DEK que re-envolver.
      const metadata = this.metadata;
      if (metadata === null) {
        throw new VaultNotInitializedError();
      }

      // El cambio de PIN también respeta la espera por intentos fallidos.
      this.assertNotLocked(metadata);

      // Se deriva la KEK actual para abrir la DEK existente.
      const currentKek = await deriveKek(currentPin, metadata.kdf.salt, metadata.kdf.iterations);

      // Si el llavero se bloqueó durante PBKDF2, no se continúa.
      this.assertGeneration(generation);

      let transientDataKey: CryptoKey;

      try {
        // Excepción controlada: hace falta una DEK extraíble para poder re-envolverla.
        transientDataKey = await getWebCrypto().subtle.unwrapKey(
          'raw',
          toBufferSource(metadata.wrappedDataKey),
          currentKek,
          KEK_ALGORITHM,
          { name: DATA_KEY_ALGORITHM, length: AES_KEY_LENGTH_BITS },
          true,
          ['encrypt', 'decrypt'],
        );
      } catch {
        // Un bloqueo durante el intento no debe contar como PIN incorrecto.
        this.assertGeneration(generation);

        // Un PIN actual incorrecto cuenta como intento fallido.
        await this.registerFailure(metadata);
        throw new IncorrectPinError();
      }

      // Un bloqueo durante el desenvolvimiento invalida el resultado.
      this.assertGeneration(generation);

      // Se genera un salt nueva para la KEK nueva.
      const newSalt = generateSalt();

      // Nunca se bajan las iteraciones de un almacén existente al cambiar el PIN.
      const newIterations = Math.max(this.iterations, metadata.kdf.iterations);

      // Se deriva la KEK nueva con la salt nueva.
      const newKek = await deriveKek(newPin, newSalt, newIterations);

      // Un bloqueo durante la derivación nueva invalida el resultado.
      this.assertGeneration(generation);

      // Se re-envuelve la misma DEK; no se vuelven a cifrar los registros.
      const newWrappedDataKey = new Uint8Array(
        await getWebCrypto().subtle.wrapKey('raw', transientDataKey, newKek, KEK_ALGORITHM),
      );

      // La DEK activa vuelve a ser no extraíble.
      const dataKey = await getWebCrypto().subtle.unwrapKey(
        'raw',
        toBufferSource(newWrappedDataKey),
        newKek,
        KEK_ALGORITHM,
        { name: DATA_KEY_ALGORITHM, length: AES_KEY_LENGTH_BITS },
        false,
        ['encrypt', 'decrypt'],
      );

      // Se preparan los metadatos con la salt y la DEK envuelta nuevas.
      const changedMetadata: CryptoMetadata = {
        v: CRYPTO_FORMAT_VERSION,
        kdf: {
          alg: 'PBKDF2',
          hash: 'SHA-256',
          iterations: newIterations,
          salt: newSalt,
        },
        wrappedDataKey: newWrappedDataKey,
        failedAttempts: 0,
        lockedUntil: null,
      };

      // Si el llavero se bloqueó durante la re-envoltura, no se persiste nada.
      this.assertGeneration(generation);

      // Se persiste el cambio antes de publicar la DEK nueva.
      await this.store.save(changedMetadata);

      // Los metadatos existen aunque un bloqueo tardío impida publicar la clave.
      this.metadata = changedMetadata;

      // Se comprueba de nuevo el bloqueo, que pudo ocurrir durante la escritura.
      this.assertGeneration(generation);

      // Se publica la DEK nueva y el estado desbloqueado.
      this.dataKey = dataKey;
    });
  }

  getState(): VaultState {
    // Una DEK presente implica un almacén desbloqueado.
    if (this.dataKey !== null) {
      return 'unlocked';
    }

    // Con metadatos pero sin DEK, el almacén está bloqueado.
    if (this.metadata !== null) {
      return 'locked';
    }

    // Sin metadatos, todavía no existe un almacén.
    return 'uninitialized';
  }

  async withDataKey<T>(operation: (session: DataKeySession) => Promise<T>): Promise<T> {
    // Se toma la referencia actual de la DEK.
    const dataKey = this.dataKey;

    // Sin DEK no se permite cifrar ni descifrar.
    if (dataKey === null) {
      throw new VaultLockedError();
    }

    // La vista no expone la clave y comprueba el bloqueo en cada operación.
    const session: DataKeySession = {
      extractable: dataKey.extractable,
      encrypt: async <T>(table: string, id: string, value: T): Promise<EncryptedRecord> => {
        this.assertDataKey(dataKey);
        const encrypted = await encryptRecord(dataKey, table, id, value);

        // Si el llavero se bloqueó durante el cifrado, no se entrega el resultado.
        this.assertDataKey(dataKey);
        return encrypted;
      },
      decrypt: async <T>(table: string, id: string, record: EncryptedRecord): Promise<T> => {
        this.assertDataKey(dataKey);
        const decrypted = await decryptRecord<T>(dataKey, table, id, record);

        // Si el llavero se bloqueó durante el descifrado, no se entrega el texto plano.
        this.assertDataKey(dataKey);
        return decrypted;
      },
    };

    // La operación recibe la vista acotada mientras el almacén está desbloqueado.
    return operation(session);
  }

  /** Lee los metadatos sin pasar por la cola; solo se usa dentro de una operación serializada. */
  private async loadMetadata(): Promise<VaultState> {
    // Si ya hay una DEK activa, el estado es desbloqueado y no se vuelve a leer.
    if (this.dataKey !== null) {
      return 'unlocked';
    }

    // Se leen los metadatos persistidos.
    const stored = await this.store.load();

    // La ausencia de metadatos significa que el almacén nunca se inicializó.
    this.metadata = stored === null ? null : parseCryptoMetadata(stored, this.minimumIterations);

    // Se devuelve el estado derivado de la presencia de metadatos.
    return this.getState();
  }

  /** Serializa las operaciones que leen o escriben metadatos. */
  private runExclusive<T>(task: () => Promise<T>): Promise<T> {
    // La tarea espera a que termine la anterior, haya acertado o fallado.
    const result = this.operationQueue.then(task, task);

    // La cola avanza aunque la tarea rechace; el error se propaga por `result`.
    this.operationQueue = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  }

  /** Invalida una operación si `lock()` se ejecutó mientras esperaba. */
  private assertGeneration(generation: number): void {
    // Una generación distinta significa que el llavero se bloqueó durante la operación.
    if (this.lockGeneration !== generation) {
      throw new VaultLockedError();
    }
  }

  /** Comprueba que la vista de la DEK sigue correspondiendo a la clave activa. */
  private assertDataKey(expected: CryptoKey): void {
    // Un bloqueo o un desbloqueo nuevo invalidan cualquier vista anterior.
    if (this.dataKey !== expected) {
      throw new VaultLockedError();
    }
  }

  /** Lanza si todavía queda una espera activa. */
  private assertNotLocked(metadata: CryptoMetadata): void {
    // Si no hay espera, se puede intentar.
    if (metadata.lockedUntil === null) {
      return;
    }

    // Se calcula el tiempo restante con el reloj inyectado.
    const remaining = metadata.lockedUntil - this.now();

    // Una espera futura impide el intento sin consumir el PIN.
    if (remaining > 0) {
      throw new TooManyAttemptsError(remaining);
    }
  }

  /** Incrementa y persiste el contador de fallos. */
  private async registerFailure(metadata: CryptoMetadata): Promise<void> {
    // Se calcula el nuevo total de fallos.
    const failedAttempts = metadata.failedAttempts + 1;

    // Se obtiene la espera correspondiente al nuevo total.
    const delay = delayForFailures(failedAttempts);

    // La espera se cuenta desde el instante actual.
    const lockedUntil = delay > 0 ? this.now() + delay : null;

    // Se preparan los metadatos actualizados.
    const failedMetadata: CryptoMetadata = {
      ...metadata,
      failedAttempts,
      lockedUntil,
    };

    // Se persiste el fallo para que sobreviva a una recarga.
    await this.store.save(failedMetadata);

    // Se actualiza la copia en memoria.
    this.metadata = failedMetadata;
  }
}

/** Crea un llavero aislado; las pruebas pueden inyectar almacén, reloj e iteraciones. */
export function createKeyring(options: KeyringOptions): Keyring {
  // La instancia concreta queda oculta detrás de la interfaz pública.
  return new KeyringImplementation(options);
}
