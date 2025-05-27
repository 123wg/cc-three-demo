/**
* 自定义CCPass
*/

import { Color, IUniform, LinearFilter, Material, NoBlending, OrthographicCamera, PerspectiveCamera, RGBAFormat, Scene, ShaderMaterial, SRGBColorSpace, SRGBToLinear, Texture, Uniform, UniformsUtils, Vector2, WebGLRenderer, WebGLRenderTarget } from "three";
import { FullScreenQuad, Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { EN_RENDER_MODE } from "./renderState";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader.js";
import { sRGBTransferEOTF } from "three/tsl";

export type CCPassParams = {
    scene:Scene, 
    camera:PerspectiveCamera | OrthographicCamera, 
    resolution:Vector2,
    mode:EN_RENDER_MODE
}

export class CCPass extends Pass {
    // 基础参数
    private _scene:Scene;
    private _camera:PerspectiveCamera | OrthographicCamera;
    private _resolution:Vector2;

    // 缓存旧参数
    private _oldAutoClear = true;
    private _oldClearColor:Color = new Color();
    private _oldClearAlpha:number = 0;
    
    // 对应渲染模式的内部参数
    private _colored = true;
    private _edge = true;
    private _transparent = false;

    // 渲染用
    private _outputRT:WebGLRenderTarget;
    private _fsQuad:FullScreenQuad;
    private _copyMaterial:ShaderMaterial;
    private _copyUniforms:{
        tDiffuse:IUniform<Texture>;
        opacity:IUniform;
    }
    
    constructor(params:CCPassParams){
        super();
        this._scene = params.scene;
        this._camera = params.camera;
        this._resolution = params.resolution;

        this._fsQuad = new FullScreenQuad();
        this._initOutputRT();
        this._initCopyMaterial();
    }


    /**
    * RT中copy出Mat
    */
    private _initCopyMaterial(){
        const copyShader = CopyShader
        this._copyUniforms = UniformsUtils.clone(copyShader.uniforms)
        this._copyMaterial = new ShaderMaterial({
            defines:{
                SRGB_TRANSFER:''
            },
            uniforms: this._copyUniforms,
            vertexShader: copyShader.vertexShader,
            fragmentShader: copyShader.fragmentShader,
            blending: NoBlending,
            depthTest: false,
            depthWrite: false,
        })
    }


    private _initOutputRT(){
        this._outputRT?.dispose();
        this._outputRT = new WebGLRenderTarget(this._resolution.x, this._resolution.y, {
            minFilter:LinearFilter,
            magFilter:LinearFilter,
            format:RGBAFormat,
            samples:4,
        });
    }

    /**
    * 缓存旧的设置
    */
    private _cacheOldSetting(renderer:WebGLRenderer){
        renderer.getClearColor(this._oldClearColor);
        this._oldClearAlpha = renderer.getClearAlpha();
        this._oldAutoClear = renderer.autoClear;

        renderer.autoClear = false;
        renderer.setClearColor(0xffffff,1);
        renderer.clear();
    }


    /**
    * 渲染面
    */
    private _renderMesh(renderer: WebGLRenderer) {
        this._renderSceneToRT(renderer,this._outputRT,null)
    }


    /**
    * 渲染线
    */
    private _renderEdge(renderer: WebGLRenderer) {

    }

    
    /**
    * 恢复旧的设置
    */
    private _recoverOldSetting(renderer:WebGLRenderer){ 
        renderer.setClearColor(this._oldClearColor, this._oldClearAlpha);
        renderer.autoClear = this._oldAutoClear;
    }



    /** 
    * 上屏
    */
    private _renderToScreen(renderer: WebGLRenderer){
        this._copyUniforms.tDiffuse.value = this._outputRT.texture
        this._renderWithFsq(renderer, null, this._copyMaterial)
    }



    public render(renderer: WebGLRenderer, writeBuffer: WebGLRenderTarget, readBuffer: WebGLRenderTarget, deltaTime: number, maskActive: boolean): void {
        this._cacheOldSetting(renderer)
        this._renderMesh(renderer)
        this._renderEdge(renderer)
        this._recoverOldSetting(renderer)
        this._renderToScreen(renderer)
    }


    /**
    * 当前场景使用覆盖材质渲染到RT
    */
    private _renderSceneToRT(renderer:WebGLRenderer, RT:WebGLRenderTarget, material:Material | null) {
        this._scene.overrideMaterial = material
        renderer.setRenderTarget(RT);
        renderer.clear();
        renderer.render(this._scene, this._camera)
    }

    /**
    * 全屏四边形渲染
    * @param renderer 渲染器
    * @param RT 渲染目标 为空时上屏
    * @param material 全屏Mesh使用的材质
    */
    private _renderWithFsq(renderer: WebGLRenderer, RT:WebGLRenderTarget | null, material:Material){
        this._fsQuad.material = material;
        renderer.setRenderTarget(RT);
        renderer.clear();
        this._fsQuad.render(renderer)
    }

    /**
    * 设置是否显示
    */
    private _setTransparent(value:boolean){

    }

    /**
    * 设置渲染模式
    */
   public setRenderMode(mode:EN_RENDER_MODE) {
        switch (mode) {
            case EN_RENDER_MODE.colorMode:
                this._colored = true;
                this._edge = false;
                this._setTransparent(false)
                break;
            case EN_RENDER_MODE.edgeMode:
                this._colored = false;
                this._edge = true;
                this._setTransparent(false)
                break;
            case EN_RENDER_MODE.edgeColorMode:
                this._colored = true;
                this._edge = true;
                this._setTransparent(false)
                break;
            
            case EN_RENDER_MODE.translucentMode:
                this._colored = true;
                this._edge = true;
                this._setTransparent(true)
                break;
        }
   }
}