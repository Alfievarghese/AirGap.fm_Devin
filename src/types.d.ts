declare module 'ggwave' {
  interface GGWaveModule {
    init(params: unknown): number;
    free(instance: number): void;
    encode(
      instance: number,
      payload: string | Uint8Array,
      protocolId: number,
      volume: number
    ): Float32Array;
    decode(instance: number, samples: Float32Array): Uint8Array | null;
    getDefaultParameters(): Record<string, unknown>;
    ProtocolId: Record<string, number>;
    TxProtocolId?: Record<string, number>;
  }

  function ggwaveFactory(): Promise<GGWaveModule>;
  export default ggwaveFactory;
}

declare module '*.css' {}
