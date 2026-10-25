// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';

import { RULES_PACKAGE_NAME } from './index';

describe('rules package scaffold', () => {
  it('exposes its package name', () => {
    expect(RULES_PACKAGE_NAME).toBe('@saviatech/rules');
  });
});
