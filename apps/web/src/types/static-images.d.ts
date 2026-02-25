// File: apps/web/src/types/static-images.d.ts

declare module "*.png" {
  import type { StaticImageData } from "next/image";
  const content: StaticImageData;
  export default content;
}
