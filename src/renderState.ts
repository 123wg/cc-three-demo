/**
 * 
 * @company CC Technology
 * @author wg
 * @date 2025-05-19
 * 
 * @license
 * This file is proprietary to CC Technology and may not be reproduced, distributed, 
 * or used without permission. All rights reserved.
 * 
 * @version-history
 * 
 * - **1.0.0** (2025-05-19) - Initial version.
 *   - **Author**: wg
 *   - **Changes**: Created.
 */

export enum EN_RENDER_MODE  {
    /**着色*/
    edgeColorMode = 'edgeColorMode',
    /**线框*/
    edgeMode = 'edgeMode',
    /**渲染*/
    colorMode = 'colorMode',
    /**透明*/
    translucentMode = 'translucentMode'
}


// TODO dirty机制、性能、调试面板、GPU拾取等都添加进来
export class RenderState {
    /**约束图标深度衰减*/
    private _constraintAttenuation = true;

    private _renderMode: EN_RENDER_MODE = EN_RENDER_MODE.edgeColorMode;

    public get renderMode(): EN_RENDER_MODE {
        return this._renderMode;
    }

    public set renderMode(value: EN_RENDER_MODE) {
        this._renderMode = value;
    }

    public get constraintAttenuation(): boolean {
        return this._constraintAttenuation;
    }

    public set constraintAttenuation(value: boolean) {
        this._constraintAttenuation = value;
    }
}

export const renderState = new RenderState()