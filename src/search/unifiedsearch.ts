import { searchOverlays } from '../flexsearch';
import { MapName } from '../data_sources/tile_data';
import { debounce } from '../util';
import { UnifiedSearchResults, UnifiedSearchResult } from './unifiedsearchresults';
import { TargetOfInterest, Spell } from '../data_sources/overlays';
import spells from '../data/spells.json';

export type UnifiedSearchCreateOptions = {
  currentMap: MapName;
  form: HTMLFormElement;
};

type UnifiedSearchConstructOptions = {
  currentMap: MapName;
  form: HTMLFormElement;
  searchInput: HTMLInputElement;
  searchResults: UnifiedSearchResults;
};

export interface UnifiedSearch {
  on(event: 'selected', listener: (target: TargetOfInterest | { type: 'spell', spell: any }) => void): this;
}

export class UnifiedSearch extends EventEmitter2 {
  private lastSearchText: string = '';

  private form: HTMLFormElement;
  private searchInput: HTMLInputElement;
  private searchResults: SearchResults;

  public currentMap: MapName;

  private constructor({ currentMap, form, searchInput, searchResults }: UnifiedSearchConstructOptions) {
    super();

    this.currentMap = currentMap;
    this.form = form;
    this.searchInput = searchInput;
    this.searchResults = searchResults;

    this.bindEvents();
  }

  private bindEvents() {
    this.searchResults.on('selected', (result: any) => {
      if (result.type === 'spell') {
        this.emit('selected', result);
      } else {
        this.emit('selected', result);
      }
    });

    const debounced = debounce(100, () => this.updateSearchResults());

    // never submit the form
    this.form.addEventListener('submit', ev => {
      ev.preventDefault();
      // if the "search" event isn't present, still update the search
      // results when the user hits enter in the search box
      debounced();
    });

    // nonstandard event for when user hits enter (or clicks the x) in
    // an <input type="search">
    this.searchInput.addEventListener('search', debounced);

    // "live" search - show list of results as the user types
    this.searchInput.addEventListener('keyup', ev => {
      if (!(ev.altKey || ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.isComposing)) {
        switch (ev.key) {
          case 'Escape':
            this.searchInput.value = '';
            this.updateSearchResults();
            break;
          case 'ArrowDown':
            this.searchResults.focusNext();
            return;
          case 'ArrowUp':
            this.searchResults.focusPrevious();
            return;
        }
      }
      debounced();
    });

    this.searchResults.on('blur', () => {
      this.searchInput.focus();
    });
  }

  private updateSearchResults() {
    const searchText = this.searchInput.value;
    if (this.lastSearchText === searchText) return;
    this.lastSearchText = searchText;

    if (searchText === '') {
      this.searchResults.setResults([]);
      return;
    }

    // Search for map overlays
    const mapResults = searchOverlays(this.currentMap, searchText);

    // Search for spells
    const spellResults = spells
      .filter(spell =>
        spell.name.toLowerCase().includes(searchText.toLowerCase()) ||
        spell.id.toLowerCase().includes(searchText.toLowerCase())
      )
      .map(spell => ({
        type: 'spell' as const,
        spell,
        displayName: spell.name,
        displayText: `Spell: ${spell.name} (Tiers: ${Object.keys(spell.spawnProbabilities).join(', ')})`
      }));

    // Combine results, prioritizing map results first
    const combinedResults = [...mapResults, ...spellResults];

    this.searchResults.setResults(combinedResults);
  }

  static create({ currentMap, form }: UnifiedSearchCreateOptions) {
    const searchInput = document.createElement('input');
    searchInput.classList.add('form-control');
    searchInput.id = 'unified-search-input';
    searchInput.type = 'search';
    searchInput.autofocus = true;
    searchInput.placeholder = 'Search maps, spells, locations… e.g. Kolmi, Fireball';
    searchInput.ariaLabel = 'unified search';

    const searchResultsUL = document.createElement('ul');
    searchResultsUL.id = 'unifiedSearchResults';
    form.innerHTML = '';
    form.appendChild(searchInput);
    form.appendChild(searchResultsUL);

    const searchResults = new UnifiedSearchResults(searchResultsUL);

    return new UnifiedSearch({
      currentMap,
      form,
      searchInput,
      searchResults,
    });
  }
}