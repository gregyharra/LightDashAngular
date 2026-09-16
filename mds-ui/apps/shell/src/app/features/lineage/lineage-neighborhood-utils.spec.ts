import { LineageEdge } from '../../core/models/lineage.model';
import {
  collectManualNeighborIds,
  emptyManualNeighborhood,
  hasDirectNeighbors,
  isNeighborhoodSideExpanded,
  neighborhoodSideToggleGlyph,
  toggleNeighborhoodSide,
  unionHopAndManualIds,
} from './lineage-neighborhood-utils';

const edges: LineageEdge[] = [
  { source: 'a', target: 'b' },
  { source: 'b', target: 'c' },
  { source: 'b', target: 'd' },
];

describe('lineage-neighborhood-utils', () => {
  it('both hop sides start collapsed with + glyphs and expand independently', () => {
    let state = emptyManualNeighborhood();
    expect(neighborhoodSideToggleGlyph(state, 'b', 'upstream')).toBe('+');
    expect(neighborhoodSideToggleGlyph(state, 'b', 'downstream')).toBe('+');

    state = toggleNeighborhoodSide(state, 'b', 'upstream', edges);
    expect(isNeighborhoodSideExpanded(state, 'b', 'upstream')).toBeTrue();
    expect(isNeighborhoodSideExpanded(state, 'b', 'downstream')).toBeFalse();
    expect(neighborhoodSideToggleGlyph(state, 'b', 'upstream')).toBe('−');
    expect(neighborhoodSideToggleGlyph(state, 'b', 'downstream')).toBe('+');

    state = toggleNeighborhoodSide(state, 'b', 'downstream', edges);
    expect(neighborhoodSideToggleGlyph(state, 'b', 'upstream')).toBe('−');
    expect(neighborhoodSideToggleGlyph(state, 'b', 'downstream')).toBe('−');

    state = toggleNeighborhoodSide(state, 'b', 'upstream', edges);
    expect(neighborhoodSideToggleGlyph(state, 'b', 'upstream')).toBe('+');
    expect(neighborhoodSideToggleGlyph(state, 'b', 'downstream')).toBe('−');
    expect([...collectManualNeighborIds(state)].sort()).toEqual(['c', 'd']);
  });

  it('expands one hop upstream without duplicating', () => {
    let state = emptyManualNeighborhood();
    state = toggleNeighborhoodSide(state, 'b', 'upstream', edges);
    expect(isNeighborhoodSideExpanded(state, 'b', 'upstream')).toBeTrue();
    expect([...collectManualNeighborIds(state)].sort()).toEqual(['a']);

    state = toggleNeighborhoodSide(state, 'b', 'upstream', edges);
    expect(isNeighborhoodSideExpanded(state, 'b', 'upstream')).toBeFalse();
    expect(collectManualNeighborIds(state).size).toBe(0);
  });

  it('expands one hop downstream', () => {
    let state = emptyManualNeighborhood();
    state = toggleNeighborhoodSide(state, 'b', 'downstream', edges);
    expect([...collectManualNeighborIds(state)].sort()).toEqual(['c', 'd']);
  });

  it('no-ops when side has no direct neighbors', () => {
    const state = toggleNeighborhoodSide(
      emptyManualNeighborhood(),
      'a',
      'upstream',
      edges,
    );
    expect(state.expansions).toEqual([]);
    expect(hasDirectNeighbors('a', 'upstream', edges)).toBeFalse();
    expect(hasDirectNeighbors('a', 'downstream', edges)).toBeTrue();
  });

  it('keeps a neighbor if another expansion still requires it', () => {
    let state = emptyManualNeighborhood();
    state = toggleNeighborhoodSide(state, 'c', 'upstream', edges); // adds b
    state = toggleNeighborhoodSide(state, 'd', 'upstream', edges); // adds b
    state = toggleNeighborhoodSide(state, 'c', 'upstream', edges); // remove c's expand
    expect([...collectManualNeighborIds(state)]).toEqual(['b']);
  });

  it('unions hop window with manual neighbors; null hop stays null (full/no selection)', () => {
    let state = emptyManualNeighborhood();
    state = toggleNeighborhoodSide(state, 'b', 'downstream', edges);
    expect(unionHopAndManualIds(null, state)).toBeNull();

    const hop = new Set(['b']);
    const visible = unionHopAndManualIds(hop, state)!;
    expect([...visible].sort()).toEqual(['b', 'c', 'd']);
  });

  it('after collapse, hop window still keeps nodes that were only manually added if hop covers them', () => {
    let state = emptyManualNeighborhood();
    state = toggleNeighborhoodSide(state, 'b', 'downstream', edges);
    state = toggleNeighborhoodSide(state, 'b', 'downstream', edges);
    const hop = new Set(['b', 'c']);
    expect([...unionHopAndManualIds(hop, state)!].sort()).toEqual(['b', 'c']);
  });
});
