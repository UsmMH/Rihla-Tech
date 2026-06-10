import mapboxgl from "mapbox-gl";
import MapboxWorker from "mapbox-gl/dist/mapbox-gl-csp-worker?worker";

/** Required for Mapbox GL JS to work with Vite bundling. */
mapboxgl.workerClass = MapboxWorker;

export { mapboxgl };
