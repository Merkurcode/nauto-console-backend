import { IEventConstructor, IHandlerConstructor } from '../types';

export function MQSerializableEvent(eventName?: string) {
  return function <T extends IEventConstructor>(constructor: T) {
    const name = (eventName || constructor.name).trim();

    if (!name) {
      throw new Error(
        `MQSerializableEvent: Event name cannot be empty for class ${constructor.name}`,
      );
    }
    if (name === 'Object' || name === 'Function') {
      throw new Error(
        `MQSerializableEvent: Invalid event name "${name}" for class ${constructor.name}. Use @MQSerializableEvent('YourName').`,
      );
    }

    if (EventRegistry.hasEvent(name)) {
      console.warn(
        `MQSerializableEvent: Event "${name}" is already registered. Overwriting registration.`,
      );
    }

    EventRegistry.register(name, constructor);

    Object.defineProperty(constructor, '__eventName', {
      value: name,
      writable: false,
      enumerable: false,
      configurable: false,
    });
    Object.defineProperty(constructor, '__isSerializableEvent', {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    return constructor;
  };
}

class EventRegistryService {
  private readonly eventMap = new Map<string, IEventConstructor>();

  register(name: string, ctor: IEventConstructor) {
    this.eventMap.set(name, ctor);
  }

  getConstructor(eventName: string): IEventConstructor | undefined {
    return this.eventMap.get(eventName);
  }

  hasEvent(eventName: string): boolean {
    return this.eventMap.has(eventName);
  }

  getAllRegisteredEvents(): string[] {
    return Array.from(this.eventMap.keys());
  }

  clear(): void {
    this.eventMap.clear();
  }

  getSize(): number {
    return this.eventMap.size;
  }

  serializeEvent(event: any): Record<string, any> {
    if (!event || typeof event !== 'object') {
      throw new Error('MQSerializableEvent: event must be an object');
    }

    const ctor = event.constructor as IEventConstructor | undefined;
    const eventName = ctor?.__eventName || ctor?.name;

    if (!ctor?.__isSerializableEvent) {
      throw new Error(
        `Event "${eventName || '(unknown)'}" is not decorated with @MQSerializableEvent. ` +
          `Add @MQSerializableEvent('YourEventName') to the class.`,
      );
    }
    if (!eventName || !this.hasEvent(eventName)) {
      throw new Error(
        `Event not registered: ${eventName}. Ensure @MQSerializableEvent is applied and module loaded.`,
      );
    }

    // Use toJSON method if available for better serialization control
    let serializedData: Record<string, any>;

    if (typeof event.toJSON === 'function') {
      serializedData = event.toJSON();
    } else {
      serializedData = { ...(event as Record<string, any>) };
    }

    return {
      ...serializedData,
      __eventName: eventName,
    };
  }

  getRegisteredEventNames(): string[] {
    return this.getAllRegisteredEvents();
  }

  deserializeEvent<T = any>(eventName: string, payload: Record<string, any>): T {
    const ctor = this.getConstructor(eventName);
    if (!ctor) {
      const availableEvents = this.getRegisteredEventNames();
      throw new Error(
        `Event constructor not found for: ${eventName}. ` +
          `Available events: ${availableEvents.length > 0 ? availableEvents.join(', ') : 'none'}. ` +
          `Make sure the event class is decorated with @MQSerializableEvent and imported.`,
      );
    }

    const clean = { ...payload };
    delete (clean as any).__eventName;

    const anyCtor = ctor as any;

    // Try custom fromJSON method first
    if (typeof anyCtor.fromJSON === 'function') {
      return anyCtor.fromJSON(clean);
    }

    // Try to reconstruct using constructor parameters
    try {
      // For events with constructor parameters, try to call constructor with payload values
      // This is a heuristic approach - ideally events should implement fromJSON for complex cases
      const parameterNames = this.getConstructorParameterNames(ctor);

      if (parameterNames.length > 0) {
        const args = parameterNames.map(param => clean[param]);

        return new ctor(...args) as T;
      }
    } catch (constructorError) {
      // Fall back to Object.assign if constructor approach fails
      console.warn(
        `Failed to use constructor for ${eventName}, falling back to Object.assign:`,
        constructorError.message,
      );
    }

    // Fallback: create instance and assign properties
    const instance = Object.create(ctor.prototype);
    Object.assign(instance, clean);

    return instance as T;
  }

  private getConstructorParameterNames(ctor: IEventConstructor): string[] {
    // Try to extract parameter names from constructor
    const ctorString = ctor.toString();
    const match = ctorString.match(/constructor\s*\([^)]*\)/);

    if (!match) return [];

    const paramsString = match[0].replace(/constructor\s*\(|\)/g, '');
    if (!paramsString.trim()) return [];

    return paramsString
      .split(',')
      .map(param => {
        // Extract parameter name, handling TypeScript patterns like 'public readonly name: string'
        const cleanParam = param.trim().replace(/^(public|private|protected|readonly)\s+/, '');
        const paramName = cleanParam.split(':')[0].trim();

        return paramName;
      })
      .filter(name => name && !name.includes('...'));
  }
}

export const EventRegistry = new EventRegistryService();

export function MQSerializableEventHandler(...eventClasses: IEventConstructor[]) {
  return function <T extends IHandlerConstructor>(constructor: T) {
    if (!eventClasses.length) {
      throw new Error(
        `MQSerializableEventHandler: Must specify at least one event class for handler ${constructor.name}`,
      );
    }

    const eventNames: string[] = [];
    for (const eventClass of eventClasses) {
      const eventName = eventClass.__eventName || eventClass.name;
      eventNames.push(eventName);

      if (!EventRegistry.hasEvent(eventName)) {
        console.warn(
          `MQSerializableEventHandler: Event "${eventName}" not found in registry. Make sure it has @MQSerializableEventHandler decorator.`,
        );
      }
    }

    HandlerRegistry.register(constructor, eventNames);

    Object.defineProperty(constructor, '__handlesEvents', {
      value: eventNames,
      writable: false,
      enumerable: false,
      configurable: false,
    });
    Object.defineProperty(constructor, '__handledEventClasses', {
      value: eventClasses,
      writable: false,
      enumerable: false,
      configurable: false,
    });
    Object.defineProperty(constructor, '__isSerializableHandler', {
      value: true,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    return constructor;
  };
}

class HandlerRegistryService {
  private readonly handlerMap = new Map<IHandlerConstructor, string[]>();
  private readonly eventToHandlers = new Map<string, IHandlerConstructor[]>();

  register(handler: IHandlerConstructor, eventNames: string[]) {
    this.handlerMap.set(handler, eventNames);

    for (const eventName of eventNames) {
      if (!this.eventToHandlers.has(eventName)) {
        this.eventToHandlers.set(eventName, []);
      }
      this.eventToHandlers.get(eventName)!.push(handler);
    }
  }

  getHandlersForEvent(eventName: string): IHandlerConstructor[] {
    return this.eventToHandlers.get(eventName) || [];
  }

  getEventsForHandler(handler: IHandlerConstructor): string[] {
    return this.handlerMap.get(handler) || [];
  }

  getAllRegisteredHandlers(): string[] {
    return Array.from(this.handlerMap.keys()).map(h => h.name);
  }

  getAllHandlerConstructors(): IHandlerConstructor[] {
    return Array.from(this.handlerMap.keys());
  }

  clear(): void {
    this.handlerMap.clear();
    this.eventToHandlers.clear();
  }
}

export const HandlerRegistry = new HandlerRegistryService();
