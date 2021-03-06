/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'vs/css!./media/dialogModal';
import { NgModuleRef } from '@angular/core';
import { IModalDialogStyles } from 'sql/base/browser/ui/modal/modal';
import { Dialog, DialogTab } from 'sql/platform/dialog/dialogTypes';
import { TabbedPanel, IPanelTab, IPanelView } from 'sql/base/browser/ui/panel/panel';
import { IBootstrapService } from 'sql/services/bootstrap/bootstrapService';
import { DialogModule } from 'sql/platform/dialog/dialog.module';
import { DialogComponentParams } from 'sql/platform/dialog/dialogContainer.component';
import { Builder } from 'vs/base/browser/builder';
import { IThemable } from 'vs/platform/theme/common/styler';
import { Disposable } from 'vs/base/common/lifecycle';
import Event, { Emitter } from 'vs/base/common/event';

export class DialogPane extends Disposable implements IThemable {
	private _tabbedPanel: TabbedPanel;
	private _moduleRefs: NgModuleRef<{}>[] = [];

	// Validation
	private _modelViewValidityMap = new Map<string, boolean>();

	// HTML Elements
	private _body: HTMLElement;
	private _tabBar: HTMLElement;
	private _tabs: HTMLElement[];
	private _tabContent: HTMLElement[];

	constructor(
		private _title: string,
		private _content: string | DialogTab[],
		private _validityChangedCallback: (valid: boolean) => void,
		private _bootstrapService: IBootstrapService
	) {
		super();
		this._tabs = [];
		this._tabContent = [];
	}

	public createBody(container: HTMLElement): HTMLElement {
		new Builder(container).div({ class: 'dialogModal-pane' }, (bodyBuilder) => {
			this._body = bodyBuilder.getHTMLElement();
			if (typeof this._content === 'string' || this._content.length < 2) {
				let modelViewId = typeof this._content === 'string' ? this._content : this._content[0].content;
				this.initializeModelViewContainer(this._body, modelViewId);
			} else {
				this._tabbedPanel = new TabbedPanel(this._body);
				this._content.forEach((tab, tabIndex) => {
					let tabContainer = document.createElement('div');
					tabContainer.style.display = 'none';
					this._body.appendChild(tabContainer);
					this.initializeModelViewContainer(tabContainer, tab.content, tab);
					this._tabbedPanel.pushTab({
						title: tab.title,
						identifier: 'dialogPane.' + this._title + '.' + tabIndex,
						view: {
							render: (container) => {
								if (tabContainer.parentElement === this._body) {
									this._body.removeChild(tabContainer);
								}
								container.appendChild(tabContainer);
								tabContainer.style.display = 'block';
							},
							layout: (dimension) => { }
						} as IPanelView
					} as IPanelTab);
				});
			}
		});

		return this._body;
	}

	/**
	 * Bootstrap angular for the dialog's model view controller with the given model view ID
	 */
	private initializeModelViewContainer(bodyContainer: HTMLElement, modelViewId: string, tab?: DialogTab) {
		this._bootstrapService.bootstrap(
			DialogModule,
			bodyContainer,
			'dialog-modelview-container',
			{
				modelViewId: modelViewId,
				validityChangedCallback: (valid: boolean) => {
					this._setValidity(modelViewId, valid);
					if (tab) {
						tab.notifyValidityChanged(valid);
					}
				}
			} as DialogComponentParams,
			undefined,
			(moduleRef) => this._moduleRefs.push(moduleRef));
	}

	public show(): void {
		this._body.classList.remove('dialogModal-hidden');
	}

	public hide(): void {
		this._body.classList.add('dialogModal-hidden');
	}

	/**
	 * Called by the theme registry on theme change to style the component
	 */
	public style(styles: IModalDialogStyles): void {
		this._body.style.backgroundColor = styles.dialogBodyBackground ? styles.dialogBodyBackground.toString() : undefined;
		this._body.style.color = styles.dialogForeground ? styles.dialogForeground.toString() : undefined;
	}

	private _setValidity(modelViewId: string, valid: boolean) {
		let oldValidity = this.isValid();
		this._modelViewValidityMap.set(modelViewId, valid);
		let newValidity = this.isValid();
		if (newValidity !== oldValidity) {
			this._validityChangedCallback(newValidity);
		}
	}

	private isValid(): boolean {
		let valid = true;
		this._modelViewValidityMap.forEach(value => valid = valid && value);
		return valid;
	}

	public dispose() {
		super.dispose();
		this._body.remove();
		this._moduleRefs.forEach(moduleRef => moduleRef.destroy());
	}
}
