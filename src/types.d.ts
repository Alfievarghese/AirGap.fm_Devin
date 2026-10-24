declare module 'ggwave' {
  export interface GGWaveModule {
    init(params: unknown): number;
    free(instance: number): void;
    encode(
      instance: number,
      payload: string | Uint8Array,
      protocolId: unknown,
      volume: number
    ): Int8Array;
    decode(instance: number, samples: Int8Array | string | Float32Array): Uint8Array | null;
    getDefaultParameters(): Record<string, unknown>;
    ProtocolId: Record<string, unknown>;
    TxProtocolId?: Record<string, unknown>;
  }

  function ggwaveFactory(): Promise<GGWaveModule>;
  export default ggwaveFactory;
}

declare module '*.css' {}
