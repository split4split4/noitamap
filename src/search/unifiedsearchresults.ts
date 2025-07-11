import { TargetOfInterest } from '../data_sources/overlays';
import { Spell } from '../data_sources/overlays';

export type UnifiedSearchResult = TargetOfInterest | { type: 'spell', spell: Spell, displayName: string, displayText: string };

export interface UnifiedSearchResults {
  on(event: 'selected', listener: (target: UnifiedSearchResult) => void): this;
  on(event: 'blur', listener: () => void): this;
}

export class UnifiedSearchResults extends EventEmitter2 {
  private targetByElement = new WeakMap<Element, UnifiedSearchResult>();
  private currentElement: Element | null = null;

  private wrapper: HTMLUListElement;
  constructor(wrapper: HTMLUListElement) {
    super();

    this.wrapper = wrapper;
    this.wrapper.innerHTML = '';
    this.bindEvents();
  }

  private bindEvents() {
    this.wrapper.addEventListener('keyup', ev => {
      if (ev.altKey || ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.isComposing) return;

      let handled = true;
      switch (ev.key) {
        case 'Escape':
          this.blur();
          break;
        case 'Enter':
          this.onSelected(ev);
          break;
        case 'ArrowDown':
          this.focusNext();
          break;
        case 'ArrowUp':
          this.focusPrevious();
          break;
        default:
          handled = false;
          break;
      }

      if (handled) ev.stopPropagation();
    });

    this.wrapper.addEventListener('click', ev => this.onSelected(ev));
  }

  private onSelected(ev: MouseEvent | KeyboardEvent) {
    if (!ev.target) return;

    if (!(ev.target instanceof HTMLLIElement)) return;

    // when we've selected an element, find the data
    // we stored for that element, and emit it
    const target = this.targetByElement.get(ev.target);
    if (!target) return;

    ev.stopPropagation();

    this.emit('selected', target);
    // If the result is a spell, emit a custom event for spell overlays
    if ('type' in target && target.type === 'spell') {
      const spellSelectedEvent = new CustomEvent('spell-selected', { detail: target });
      window.dispatchEvent(spellSelectedEvent);
    }
  }

  private blur() {
    this.currentElement = null;
    this.emit('blur');
  }

  private focus(target: Element | null) {
    if (!(target instanceof HTMLElement)) return;
    this.currentElement = target;
    target.focus();
  }

  focusPrevious() {
    // when we select the previous and we're already at the top, allow
    // the search input to retrieve the focus
    if (this.currentElement === this.wrapper.firstElementChild) {
      this.blur();
    } else {
      this.focus(this.currentElement?.previousElementSibling ?? null);
    }
  }

  focusNext() {
    this.focus(this.currentElement ? this.currentElement.nextElementSibling : this.wrapper.firstElementChild);
  }

  private clearResults(hide: boolean = true) {
    this.currentElement = null;
    this.wrapper.innerHTML = '';
    // this.wrapper.style.display = hide ? 'none' : 'block';
  }

  setResults(results: UnifiedSearchResult[]) {
    this.clearResults(results.length === 0);

    for (const [idx, result] of results.entries()) {
      const listItem = document.createElement('li');
      listItem.classList.add('search-result');
      listItem.tabIndex = idx;
      this.targetByElement.set(listItem, result);

      if ('type' in result && result.type === 'spell') {
        // Handle spell results with image
        const img = document.createElement('img');
        img.src = `./assets/icons/spells/${result.spell.sprite}`;
        img.classList.add('pixelated-image');
        img.alt = result.spell.name;
        img.onerror = () => {
          img.src = './assets/icons/spells/missing.png';
          img.alt = 'Missing';
        };
        listItem.appendChild(img);
        const textDiv = document.createElement('div');
        textDiv.textContent = result.displayText;
        listItem.appendChild(textDiv);
      } else if ('overlayType' in result) {
        // Handle map overlay results
        switch (result.overlayType) {
          case 'poi':
            listItem.textContent = result.name;
            if ('aliases' in result && result.aliases) {
              listItem.textContent += ` (${result.aliases.join(', ')})`;
            }
            break;

          case 'aoi':
            listItem.textContent = result.text.join('; ');
            break;
        }
      }

      this.wrapper.appendChild(listItem);
    }
  }
}