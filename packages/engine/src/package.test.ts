import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };

describe('@casinogames/engine package', () => {
  it('has zero runtime dependencies', () => {
    expect(pkg).not.toHaveProperty('dependencies');
    expect(pkg).not.toHaveProperty('peerDependencies');
    expect(pkg).not.toHaveProperty('optionalDependencies');
  });
});
