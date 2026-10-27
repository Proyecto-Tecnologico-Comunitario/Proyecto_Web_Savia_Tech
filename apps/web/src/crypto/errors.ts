// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Errores de dominio del módulo de cifrado.
 *
 * Los mensajes son genéricos y no incluyen PIN, claves, IV, texto plano ni ciphertext. La interfaz
 * traducirá estos errores a textos de usuario en sus archivos de i18n.
 */

/** Error base para que la interfaz pueda distinguir fallos del dominio criptográfico. */
export class CryptoDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** La API WebCrypto no está disponible en este contexto. */
export class CryptoUnavailableError extends CryptoDomainError {
  constructor() {
    super('Web Crypto is not available in this context');
  }
}

/** El PIN no cumple la política mínima. */
export class InvalidPinError extends CryptoDomainError {
  constructor() {
    super('PIN must contain at least six digits');
  }
}

/** El PIN no permite desenvolver la DEK. */
export class IncorrectPinError extends CryptoDomainError {
  constructor() {
    super('Incorrect PIN');
  }
}

/** Se intentó usar una clave sin desbloquear el almacén. */
export class VaultLockedError extends CryptoDomainError {
  constructor() {
    super('The vault is locked');
  }
}

/** Los datos cifrados o los metadatos están corruptos o fueron manipulados. */
export class CorruptDataError extends CryptoDomainError {
  constructor() {
    super('Encrypted data is corrupt');
  }
}

/** Ya existe un almacén inicializado en este dispositivo. */
export class VaultAlreadyInitializedError extends CryptoDomainError {
  constructor() {
    super('The vault is already initialized');
  }
}

/** Todavía no existe un almacén inicializado. */
export class VaultNotInitializedError extends CryptoDomainError {
  constructor() {
    super('The vault is not initialized');
  }
}

/** Queda una espera activa antes de volver a intentar el PIN. */
export class TooManyAttemptsError extends CryptoDomainError {
  /** Milisegundos que faltan para poder reintentar. */
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super('Too many failed attempts');
    this.retryAfterMs = Math.max(0, retryAfterMs);
  }
}

/** La versión del registro o de los metadatos no está soportada. */
export class UnsupportedVersionError extends CryptoDomainError {
  /** Versión encontrada en el dato persistido. */
  readonly version: number;

  constructor(version: number) {
    super('Unsupported crypto format version');
    this.version = version;
  }
}
