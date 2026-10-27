// SPDX-License-Identifier: GPL-3.0-or-later

export type { EncryptedRecord } from './recordCipher';
export {
  CorruptDataError,
  CryptoDomainError,
  CryptoUnavailableError,
  IncorrectPinError,
  InvalidPinError,
  TooManyAttemptsError,
  UnsupportedVersionError,
  VaultAlreadyInitializedError,
  VaultLockedError,
  VaultNotInitializedError,
} from './errors';
export {
  createKeyring,
  type DataKeySession,
  type Keyring,
  type KeyringOptions,
  type VaultState,
} from './keyring';
export type { CryptoMetadata, CryptoMetadataStore } from './metadata';
export { CRYPTO_FORMAT_VERSION, PBKDF2_ITERATIONS } from './constants';
