/**
 * Global type declarations for Node.js extensions
 */

declare global {
  namespace NodeJS {
    interface IGlobal {
      /**
       * Node.js garbage collection function (available with --expose-gc flag)
       * Forces a garbage collection cycle to free up memory
       */
      gc?: () => void;
    }
  }

  /**
   * Global garbage collection function (available with --expose-gc flag)
   * Forces a garbage collection cycle to free up memory
   */
  var gc: (() => void) | undefined;
}

export {};
