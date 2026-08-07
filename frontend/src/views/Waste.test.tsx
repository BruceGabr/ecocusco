import { describe, expect, it } from 'vitest';
import { extractWasteTypes } from './Waste';

describe('extractWasteTypes', () => {
  it('devuelve una lista vacía cuando no hay texto', () => {
    expect(extractWasteTypes('')).toEqual([]);
  });

  it('separa los tipos unidos por "y"', () => {
    expect(extractWasteTypes('Organico y reciclable')).toEqual(['Organico', 'Reciclable']);
  });

  it('no parte "No reciclable" en dos tipos', () => {
    // El bug histórico: partir por " y " sin exigir espacios alrededor dejaba
    // un tipo llamado "No" en las estadísticas.
    expect(extractWasteTypes('No reciclable y reciclable')).toEqual([
      'No reciclable',
      'Reciclable',
    ]);
  });

  it('acepta comas y punto y coma como separadores', () => {
    expect(extractWasteTypes('Vidrio, papel; plastico')).toEqual([
      'Vidrio',
      'Papel',
      'Plastico',
    ]);
  });

  it('conserva los tipos de una sola palabra', () => {
    expect(extractWasteTypes('Organico')).toEqual(['Organico']);
  });
});
