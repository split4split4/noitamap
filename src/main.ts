import { App } from './app';
import { parseURL, updateURL } from './data_sources/url';
import { asOverlayKey, initSpellSelector, showOverlay } from './data_sources/overlays';
import { SearchBox } from './search/searchbox';
import { asMapName } from './data_sources/tile_data';
import { addEventListenerForId, assertElementById, debounce } from './util';
import { createMapLinks, NAV_LINK_IDENTIFIER } from './nav';
import { initMouseTracker } from './mouse_tracker';
import { isRenderer, getStoredRenderer, setStoredRenderer } from './renderer_settings';

document.addEventListener('DOMContentLoaded', async () => {
  // TODO: probably most of this should be part of the "App" class, or the "App" class should be removed.
  // i'm not sure i'm happy with the abstraction

  const navbarBrandElement = assertElementById('navbar-brand', HTMLElement);
  const osdRootElement = assertElementById('osContainer', HTMLElement);
  const searchForm = assertElementById('search-form', HTMLFormElement);
  const overlayButtonsElement = assertElementById('overlay-selector', HTMLDivElement);
  const mapSelectorButton = assertElementById('mapSelectorButton', HTMLButtonElement);
  const tooltipElement = assertElementById('coordinate', HTMLElement);
  const coordinatesText = tooltipElement.innerText;
  const rendererForm = assertElementById('renderer-form', HTMLFormElement);

  // Initialize renderer from storage
  const storedRenderer = getStoredRenderer();
  rendererForm.elements['renderer'].value = storedRenderer;

  const app = await App.create({
    mountTo: osdRootElement,
    overlayButtons: overlayButtonsElement,
    initialState: parseURL(),
    useWebGL: storedRenderer === 'webgl',
  });

  navbarBrandElement.addEventListener('click', ev => {
    ev.preventDefault();
    app.home();
  });

  // create search
  const searchBox = SearchBox.create({
    currentMap: app.getMap(),
    form: searchForm,
  });

  // link to the app
  searchBox.on('selected', toi => app.goto(toi));

  const debouncedUpdateURL = debounce(100, updateURL);
  app.on('state-change', state => {
    // record map / position / zoom changes to the URL when they happen
    debouncedUpdateURL(state);

    const currentMapLink = document.querySelector(`#navLinksList [data-map-key=${state.map}]`);
    if (!(currentMapLink instanceof HTMLElement)) return;

    // Only show the map label (not badges or patch date) in the dropdown button
    const mapLabel = currentMapLink.childNodes[0]?.textContent?.trim() || 'Available Maps';
    mapSelectorButton.textContent = mapLabel;

    // Remove "active" class from any nav links that still have it
    document.querySelectorAll('#navLinksList .nav-link.active').forEach(el => {
      el.classList.remove('active');
    });

    // Add "active" class to the nav-link identified by `mapName`
    currentMapLink.classList.add('active');
  });

  const loadingIndicator = assertElementById('loadingIndicator', HTMLElement);
  // show/hide loading indicator
  app.on('loading-change', isLoading => {
    loadingIndicator.style.display = isLoading ? 'block' : 'none';
  });

  // respond to changes of map
  const mapLinksUL = createMapLinks();
  mapLinksUL.addEventListener('click', ev => {
    if (!(ev.target instanceof HTMLElement)) return;

    const link = ev.target.closest(`.${NAV_LINK_IDENTIFIER}`);
    if (!link || !(link instanceof HTMLElement)) return;

    const newMap = link.dataset.mapKey;
    const mapName = asMapName(newMap);
    if (!mapName) {
      console.error(`Attempted to change to an unknown map: '${newMap}'`);
      return;
    }

    // load the new map
    app.setMap(mapName);
    // set which map we're searching
    searchBox.currentMap = mapName;
  });

  // manage css classes to show / hide overlays
  addEventListenerForId('overlay-selector', 'click', ev => {
    const target = ev.target;

    // not an input element
    if (!(target instanceof HTMLInputElement)) return;

    // not a checkbox
    if (target.getAttribute('type') !== 'checkbox') return;

    // overlay isn't defined on this checkbox
    const overlayKey = asOverlayKey(target.dataset.overlayKey);
    if (!overlayKey) return;

    ev.stopPropagation();

    showOverlay(overlayKey, target.checked);
  });

  // Initialize Bootstrap popovers
  for (const el of document.querySelectorAll('[data-bs-toggle="popover"]')) {
    new bootstrap.Popover(el);
  }

  // share button -- probably want some "copied to clipboard" popup/fade notification
  const shareEl = assertElementById('shareButton', HTMLElement);
  shareEl.addEventListener('click', ev => {
    ev.preventDefault();
    window.navigator.clipboard.writeText(window.location.href);
  });

  // Mouse tracker for displaying coordinates
  const { copyCoordinates } = initMouseTracker({
    osd: app.osd,
    osdElement: osdRootElement,
    tooltipElement: assertElementById('coordinate', HTMLElement),
  });
  document.addEventListener('keydown', copyCoordinates, { capture: false });

  // Restore spell selector
  initSpellSelector();

  // Handle renderer changes
  rendererForm.addEventListener('change', ev => {
    if (!ev.target.matches('input[type="radio"][name="renderer"]')) return;

    ev.stopPropagation();
    const newRenderer = rendererForm.elements['renderer'].value;

    if (isRenderer(newRenderer)) {
      setStoredRenderer(newRenderer);
      window.location.reload();
    }
  });
});
