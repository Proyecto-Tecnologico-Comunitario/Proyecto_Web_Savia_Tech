// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';

import { validateInstrument } from './instrument';
import { createInstrumentJson, type MutableInstrument } from './test-fixtures';

/**
 * Tests del validador de instrumentos.
 *
 * Cada caso parte de una copia válida y rompe un único aspecto para comprobar que la validación
 * detecta el error en la ruta esperada. Así se documenta qué garantiza el contrato del archivo de
 * contenido.
 */

function bandAt(draft: MutableInstrument, index: number): MutableInstrument['bands'][number] {
  const band = draft.bands[index];

  if (!band) {
    throw new Error(`Missing test band at index ${index}`);
  }

  return band;
}

function expectInvalidAt(mutate: (draft: MutableInstrument) => void, path: string): void {
  const draft = createInstrumentJson();
  mutate(draft);
  const result = validateInstrument(draft);

  expect(result.ok, `expected validation to fail at ${path}`).toBe(false);

  if (!result.ok) {
    expect(result.errors.map((issue) => issue.path)).toContain(path);
  }
}

describe('validateInstrument', () => {
  it('accepts the sample instrument and returns a typed copy', () => {
    const result = validateInstrument(createInstrumentJson());

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.value.id).toBe('phq9-sample');
      expect(result.value.status).toBe('SAMPLE');
      expect(result.value.languages.es.items).toHaveLength(9);
      expect(result.value.bands).toHaveLength(5);
      expect(result.value.safetyItem).toEqual({ index: 8, alertWhenAbove: 0 });
    }
  });

  it.each([null, [], 'instrument', 42])('rejects a non-object value (%j)', (value) => {
    const result = validateInstrument(value);

    expect(result.ok).toBe(false);

    if (!result.ok) {
      expect(result.errors[0]?.path).toBe('instrument');
    }
  });

  it('rejects a status other than SAMPLE', () => {
    expectInvalidAt((draft) => {
      draft.status = 'VERIFIED';
    }, 'status');
  });

  it('requires English content', () => {
    expectInvalidAt((draft) => {
      (draft.languages as unknown as Record<string, unknown>)['en'] = undefined;
    }, 'languages.en');
  });

  it('requires the same number of items in every language', () => {
    expectInvalidAt((draft) => {
      draft.languages.en.items.push('extra sample item');
    }, 'languages.en.items');
  });

  it('requires one option label per option value', () => {
    expectInvalidAt((draft) => {
      draft.languages.es.options.push('extra option');
    }, 'languages.es.options');
  });

  it('rejects blank items', () => {
    expectInvalidAt((draft) => {
      draft.languages.es.items[0] = '   ';
    }, 'languages.es.items[0]');
  });

  it('rejects option values that are not strictly increasing', () => {
    expectInvalidAt((draft) => {
      draft.optionValues = [0, 1, 1, 3];
    }, 'optionValues[2]');
  });

  it('rejects an empty optionValues list', () => {
    expectInvalidAt((draft) => {
      draft.optionValues = [];
    }, 'optionValues');
  });

  it('rejects a gap between bands', () => {
    expectInvalidAt((draft) => {
      bandAt(draft, 1).min = 6;
    }, 'bands[1].min');
  });

  it('rejects overlapping bands', () => {
    expectInvalidAt((draft) => {
      bandAt(draft, 1).min = 4;
    }, 'bands[1].min');
  });

  it('rejects bands that do not start at the minimum score', () => {
    expectInvalidAt((draft) => {
      bandAt(draft, 0).min = 1;
    }, 'bands[0].min');
  });

  it('rejects bands that do not reach the maximum score', () => {
    expectInvalidAt((draft) => {
      bandAt(draft, 4).max = 26;
    }, 'bands[4].max');
  });

  it('rejects duplicate band ids', () => {
    expectInvalidAt((draft) => {
      bandAt(draft, 1).id = 'minimal';
    }, 'bands[1].id');
  });

  it('rejects a band whose min is greater than its max', () => {
    expectInvalidAt((draft) => {
      bandAt(draft, 0).max = -1;
    }, 'bands[0]');
  });

  it('rejects non-integer band limits', () => {
    expectInvalidAt((draft) => {
      bandAt(draft, 0).min = 0.5;
    }, 'bands[0].min');
  });

  it('rejects a blank band id', () => {
    expectInvalidAt((draft) => {
      bandAt(draft, 0).id = '';
    }, 'bands[0].id');
  });

  it('rejects an empty band list', () => {
    expectInvalidAt((draft) => {
      draft.bands = [];
    }, 'bands');
  });

  it('rejects a safety item outside the item range', () => {
    expectInvalidAt((draft) => {
      draft.safetyItem.index = 9;
    }, 'safetyItem.index');
  });

  it('rejects a negative safety item index', () => {
    expectInvalidAt((draft) => {
      draft.safetyItem.index = -1;
    }, 'safetyItem.index');
  });

  it('rejects a safety threshold that is not an option value', () => {
    expectInvalidAt((draft) => {
      draft.safetyItem.alertWhenAbove = 5;
    }, 'safetyItem.alertWhenAbove');
  });

  it('rejects a safety threshold at the maximum so no alert is possible', () => {
    expectInvalidAt((draft) => {
      draft.safetyItem.alertWhenAbove = 3;
    }, 'safetyItem.alertWhenAbove');
  });

  it('rejects a missing safety item', () => {
    expectInvalidAt((draft) => {
      (draft as unknown as Record<string, unknown>)['safetyItem'] = undefined;
    }, 'safetyItem');
  });
});
