/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from 'vs/base/common/event';
import Severity from 'vs/base/common/severity';
import { URI } from 'vs/base/common/uri';
import { createDecorator } from 'vs/platform/instantiation/common/instantiation';
import { IExtensionPoint } from 'vs/workbench/services/extensions/common/extensionsRegistry';
import { ExtensionIdentifier, IExtensionManifest, IExtension, ExtensionType } from 'vs/platform/extensions/common/extensions';
import { getGalleryExtensionId } from 'vs/platform/extensionManagement/common/extensionManagementUtil';

export interface IExtensionDescription extends IExtensionManifest {
	readonly identifier: ExtensionIdentifier;
	readonly uuid?: string;
	readonly isBuiltin: boolean;
	readonly isUnderDevelopment: boolean;
	readonly extensionLocation: URI;
	enableProposedApi?: boolean;
}

export const nullExtensionDescription = Object.freeze(<IExtensionDescription>{
	identifier: new ExtensionIdentifier('nullExtensionDescription'),
	name: 'Null Extension Description',
	version: '0.0.0',
	publisher: 'vscode',
	enableProposedApi: false,
	engines: { vscode: '' },
	extensionLocation: URI.parse('void:location'),
	isBuiltin: false,
});

export const IExtensionService = createDecorator<IExtensionService>('extensionService');

export interface IMessage {
	type: Severity;
	message: string;
	extensionId: ExtensionIdentifier;
	extensionPointId: string;
}

export interface IExtensionsStatus {
	messages: IMessage[];
	activationTimes: ActivationTimes | undefined;
	runtimeErrors: Error[];
}

export type ExtensionActivationError = string | MissingDependenciesError;
export class MissingDependenciesError {
	constructor(readonly dependencies: string[]) { }
}

/**
 * e.g.
 * ```
 * {
 *    startTime: 1511954813493000,
 *    endTime: 1511954835590000,
 *    deltas: [ 100, 1500, 123456, 1500, 100000 ],
 *    ids: [ 'idle', 'self', 'extension1', 'self', 'idle' ]
 * }
 * ```
 */
export interface IExtensionHostProfile {
	/**
	 * Profiling start timestamp in microseconds.
	 */
	startTime: number;
	/**
	 * Profiling end timestamp in microseconds.
	 */
	endTime: number;
	/**
	 * Duration of segment in microseconds.
	 */
	deltas: number[];
	/**
	 * Segment identifier: extension id or one of the four known strings.
	 */
	ids: ProfileSegmentId[];

	/**
	 * Get the information as a .cpuprofile.
	 */
	data: object;

	/**
	 * Get the aggregated time per segmentId
	 */
	getAggregatedTimes(): Map<ProfileSegmentId, number>;
}

/**
 * Extension id or one of the four known program states.
 */
export type ProfileSegmentId = string | 'idle' | 'program' | 'gc' | 'self';

export class ActivationTimes {
	constructor(
		public readonly startup: boolean,
		public readonly codeLoadingTime: number,
		public readonly activateCallTime: number,
		public readonly activateResolvedTime: number,
		public readonly activationEvent: string
	) {
	}
}

export class ExtensionPointContribution<T> {
	readonly description: IExtensionDescription;
	readonly value: T;

	constructor(description: IExtensionDescription, value: T) {
		this.description = description;
		this.value = value;
	}
}

export const ExtensionHostLogFileName = 'exthost';

export interface IWillActivateEvent {
	readonly event: string;
	readonly activation: Promise<void>;
}

export interface IResponsiveStateChangeEvent {
	target: ICpuProfilerTarget;
	isResponsive: boolean;
}

export interface IExtensionService extends ICpuProfilerTarget {
	_serviceBrand: any;

	/**
	 * An event emitted when extensions are registered after their extension points got handled.
	 *
	 * This event will also fire on startup to signal the installed extensions.
	 *
	 * @returns the extensions that got registered
	 */
	onDidRegisterExtensions: Event<void>;

	/**
	 * @event
	 * Fired when extensions status changes.
	 * The event contains the ids of the extensions that have changed.
	 */
	onDidChangeExtensionsStatus: Event<ExtensionIdentifier[]>;

	/**
	 * Fired when the available extensions change (i.e. when extensions are added or removed).
	 */
	onDidChangeExtensions: Event<void>;

	/**
	 * An event that is fired when activation happens.
	 */
	onWillActivateByEvent: Event<IWillActivateEvent>;

	/**
	 * An event that is fired when an extension host changes its
	 * responsive-state.
	 */
	onDidChangeResponsiveChange: Event<IResponsiveStateChangeEvent>;

	/**
	 * Send an activation event and activate interested extensions.
	 */
	activateByEvent(activationEvent: string): Promise<void>;

	/**
	 * An promise that resolves when the installed extensions are registered after
	 * their extension points got handled.
	 */
	whenInstalledExtensionsRegistered(): Promise<boolean>;

	/**
	 * Return all registered extensions
	 */
	getExtensions(): Promise<IExtensionDescription[]>;

	/**
	 * Return a specific extension
	 * @param id An extension id
	 */
	getExtension(id: string): Promise<IExtensionDescription | undefined>;

	/**
	 * Returns `true` if the given extension can be added. Otherwise `false`.
	 * @param extension An extension
	 */
	canAddExtension(extension: IExtensionDescription): boolean;

	/**
	 * Returns `true` if the given extension can be removed. Otherwise `false`.
	 * @param extension An extension
	 */
	canRemoveExtension(extension: IExtensionDescription): boolean;

	/**
	 * Read all contributions to an extension point.
	 */
	readExtensionPointContributions<T>(extPoint: IExtensionPoint<T>): Promise<ExtensionPointContribution<T>[]>;

	/**
	 * Get information about extensions status.
	 */
	getExtensionsStatus(): { [id: string]: IExtensionsStatus };

	/**
	 * Return the inspect port or 0.
	 */
	getInspectPort(): number;

	/**
	 * Restarts the extension host.
	 */
	restartExtensionHost(): void;

	/**
	 * Starts the extension host.
	 */
	startExtensionHost(): void;

	/**
	 * Stops the extension host.
	 */
	stopExtensionHost(): void;
}

export interface ICpuProfilerTarget {

	/**
	 * Check if the extension host can be profiled.
	 */
	canProfileExtensionHost(): boolean;

	/**
	 * Begin an extension host process profile session.
	 */
	startExtensionHostProfile(): Promise<ProfileSession>;
}

export interface ProfileSession {
	stop(): Promise<IExtensionHostProfile>;
}

export function checkProposedApiEnabled(extension: IExtensionDescription): void {
	if (!extension.enableProposedApi) {
		throwProposedApiError(extension);
	}
}

export function throwProposedApiError(extension: IExtensionDescription): never {
	throw new Error(`[${extension.identifier.value}]: Proposed API is only available when running out of dev or with the following command line switch: --enable-proposed-api ${extension.identifier.value}`);
}

export function toExtension(extensionDescription: IExtensionDescription): IExtension {
	return {
		type: extensionDescription.isBuiltin ? ExtensionType.System : ExtensionType.User,
		identifier: { id: getGalleryExtensionId(extensionDescription.publisher, extensionDescription.name), uuid: extensionDescription.uuid },
		manifest: extensionDescription,
		location: extensionDescription.extensionLocation,
	};
}


export class NullExtensionService implements IExtensionService {
	_serviceBrand: any;
	onDidRegisterExtensions: Event<void> = Event.None;
	onDidChangeExtensionsStatus: Event<ExtensionIdentifier[]> = Event.None;
	onDidChangeExtensions: Event<void> = Event.None;
	onWillActivateByEvent: Event<IWillActivateEvent> = Event.None;
	onDidChangeResponsiveChange: Event<IResponsiveStateChangeEvent> = Event.None;
	activateByEvent(_activationEvent: string): Promise<void> { return Promise.resolve(undefined); }
	whenInstalledExtensionsRegistered(): Promise<boolean> { return Promise.resolve(true); }
	getExtensions(): Promise<IExtensionDescription[]> { return Promise.resolve([]); }
	getExtension() { return Promise.resolve(undefined); }
	readExtensionPointContributions<T>(_extPoint: IExtensionPoint<T>): Promise<ExtensionPointContribution<T>[]> { return Promise.resolve(Object.create(null)); }
	getExtensionsStatus(): { [id: string]: IExtensionsStatus; } { return Object.create(null); }
	canProfileExtensionHost(): boolean { return false; }
	getInspectPort(): number { return 0; }
	startExtensionHostProfile(): Promise<ProfileSession> { return Promise.resolve(Object.create(null)); }
	restartExtensionHost(): void { }
	startExtensionHost(): void { }
	stopExtensionHost(): void { }
	canAddExtension(): boolean { return false; }
	canRemoveExtension(): boolean { return false; }
}