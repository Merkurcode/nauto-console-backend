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

    return {
      ...(event as Record<string, any>),
      __eventName: eventName,
    };
  }

  deserializeEvent<T = any>(eventName: string, payload: Record<string, any>): T {
    const ctor = this.getConstructor(eventName);
    if (!ctor) {
      throw new Error(`Event constructor not found for: ${eventName}`);
    }

    const clean = { ...payload };
    delete (clean as any).__eventName;

    const anyCtor = ctor as any;
    if (typeof anyCtor.fromJSON === 'function') {
      return anyCtor.fromJSON(clean);
    }

    const instance = Object.create(ctor.prototype);
    Object.assign(instance, clean);

    return instance as T;
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
