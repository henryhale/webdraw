declare module "png-chunk-text" {
  const value: {
    encode(
      keyword: string,
      content: string,
    ): { name: string; data: Uint8Array };
  };
  export default value;
}

declare module "png-chunks-encode" {
  export default function encode(
    chunks: { name: string; data: Uint8Array }[],
  ): Uint8Array<ArrayBuffer>;
}

declare module "png-chunks-extract" {
  export default function extract(
    data: Uint8Array,
  ): { name: string; data: Uint8Array }[];
}
