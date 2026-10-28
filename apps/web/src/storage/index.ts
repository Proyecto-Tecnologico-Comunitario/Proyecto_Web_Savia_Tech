// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * API pública de la capa de almacenamiento.
 *
 * La interfaz importa desde este punto de entrada y no toca Dexie ni WebCrypto directamente. El
 * cableado de la base y el llavero corresponde a T5.
 */

export {
  type CaseRepository,
  type CaseRepositoryDependencies,
  createCaseRepository,
  type ListOptions,
  type ListResult,
  type NewCaseInput,
} from './caseRepository';
export { cryptoMetadataStore, DexieCryptoMetadataStore } from './cryptoMetadataStore';
export { type CryptoMetadataRow, SaviaDatabase, saviaDatabase } from './db';
export {
  CaseNotFoundError,
  ConcurrentModificationError,
  ImmutableFieldError,
  InvalidCaseDataError,
  StorageDomainError,
} from './errors';
export {
  estimateStorage,
  type PersistenceStatus,
  requestPersistentStorage,
  type StorageEstimateResult,
} from './persistence';
