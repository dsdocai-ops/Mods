// "I am the Alpha and the Omega, the first and the last, the beginning and the end" (Revelation 22:13).
// Vite resolves a raster image import to its built URL string - no such module actually exists on
// disk for TS to find, hence the ambient declaration. Deliberately its own file with no top-level
// import/export: a wildcard "declare module" only registers globally from a script-mode .d.ts - put
// inside a file that has imports (like global.d.ts), it'd be a local augmentation only, invisible to
// every other file that imports an image.
declare module "*.png" {
  const src: string;
  export default src;
}
