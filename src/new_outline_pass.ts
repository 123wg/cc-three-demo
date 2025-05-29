/**
* 自定义CCPass
*/

import { AxesHelper, Camera, Color, IUniform, Light, LinearFilter, LinearMipMapLinearFilter, Material, Mesh, MeshBasicMaterial, NoBlending, Object3D, OrthographicCamera, PerspectiveCamera, RGBAFormat, Scene, ShaderMaterial, SRGBColorSpace, SRGBToLinear, Texture, Uniform, UniformsUtils, Vector2, WebGLRenderer, WebGLRenderTarget } from "three";
import { FullScreenQuad, Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { EN_RENDER_MODE } from "./renderState";
import { CopyShader } from "three/examples/jsm/shaders/CopyShader.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";

export type CCPassParams = {
    scene:Scene, 
    camera:PerspectiveCamera | OrthographicCamera, 
    resolution:Vector2,
    mode:EN_RENDER_MODE
}

export type Scenelassification = {
    /**渲染目标面*/
    topoMeshList:Array<Mesh>
    /**渲染目标线*/
    topoEdgeList:Array<LineSegments2>
    /**other渲染对象*/
    otherTopoList:Array<Object3D>
    /**other灯光、相机等*/
    otherHelperList:Array<Object3D>
}

export class CCPass extends Pass {
    /**-------------------基础渲染参数-------------------------*/
    private _scene:Scene;
    private _camera:PerspectiveCamera | OrthographicCamera;
    private _resolution:Vector2;

    /**-------------------缓存旧参数---------------------------*/
    private _oldAutoClear = true;
    private _oldClearColor:Color = new Color();
    private _oldClearAlpha:number = 0;
    
    /**-------------------渲染模式对应内部数据-----------------*/
    private _colored = true;
    private _edge = true;
    private _transparent = false;

    /**-------------------渲染用参数--------------------------*/
    private _sceneClassification:Scenelassification = {
        topoMeshList: [],
        topoEdgeList: [],
        otherTopoList: [],
        otherHelperList: []
    }
    private _tmpClearColor = 0xffffff
    private _outputRT:WebGLRenderTarget;
    private _fsQuad:FullScreenQuad;
    private _copyMaterial:ShaderMaterial;
    private _copyUniforms:{
        tDiffuse:IUniform<Texture>;
        opacity:IUniform;
    }
    private _whiteMeshMat:MeshBasicMaterial;
    private _visibleCache:Map<Object3D,boolean> = new Map();
    
    constructor(params:CCPassParams){
        super();
        this._scene = params.scene;
        this._camera = params.camera;
        this._resolution = params.resolution;
        this.setRenderMode(params.mode)

        this._fsQuad = new FullScreenQuad();
        this._initMeshMat()
        this._initCopyMaterial();
        this._initOutputRT();
    }

    private _initMeshMat(){
        this._whiteMeshMat = new MeshBasicMaterial({color:this._tmpClearColor})
    }


    /**
    * RT中copy出Mat
    */
    private _initCopyMaterial(){
        const copyShader = CopyShader
        this._copyUniforms = UniformsUtils.clone(copyShader.uniforms)
        this._copyUniforms.opacity.value = 1.0
        this._copyMaterial = new ShaderMaterial({
            uniforms: this._copyUniforms,
            vertexShader: copyShader.vertexShader,
            fragmentShader: /* glsl */`
                uniform float opacity;
                uniform sampler2D tDiffuse;
                varying vec2 vUv;

                void main() {
                    vec4 texel = texture2D( tDiffuse, vUv );
                    gl_FragColor = opacity * texel;
                    gl_FragColor = sRGBTransferOETF( gl_FragColor );
                }`,
            blending: NoBlending,
            depthTest: false,
            depthWrite: false,
            transparent:true
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
    * 对场景分类,方便后续渲染从中取各种对象集合
    */
   private _sceneClassify(){
        const {topoMeshList, topoEdgeList, otherTopoList, otherHelperList} = this._sceneClassification;
        const sceneChild = this._scene.children;
        topoMeshList.length = 0;
        topoEdgeList.length = 0;
        otherTopoList.length = 0;
        otherHelperList.length = 0;
        
        for(const obj of sceneChild){
            if(obj instanceof Mesh && !(obj instanceof LineSegments2)) {
                const mat = obj.material as Material;
                mat.transparent = this._transparent;
                mat.opacity = this._transparent ? 0.5 : 1;
                topoMeshList.push(obj)
            }
            if(obj instanceof LineSegments2){
                topoEdgeList.push(obj)
            }
            if(obj instanceof AxesHelper){
                otherTopoList.push(obj)
            }
            if(obj instanceof Light) {
                otherHelperList.push(obj)
            }
        }
   }

    /**
    * 缓存旧的设置
    */
    private _cacheOldRendererSetting(renderer:WebGLRenderer){
        renderer.getClearColor(this._oldClearColor);
        this._oldClearAlpha = renderer.getClearAlpha();
        this._oldAutoClear = renderer.autoClear;

        renderer.autoClear = false;
        renderer.setClearColor(this._tmpClearColor,1);
        renderer.clear();
    }


    /**
    * 渲染面
    */
    private _renderMesh(renderer: WebGLRenderer) {
        this._changeBeforeRenderMesh()
        this._renderSceneToRT(renderer,this._outputRT,null);
        this._recoverVisibleCache()
    }


    /**
    * 渲染线
    */
    private _renderEdge(renderer: WebGLRenderer) {
        this._changeBeforeRenderEdge()
        this._renderWithRenderer(renderer, null)
        this._recoverVisibleCache()
    }

    /**
    * 渲染场景中其它物体
    */
   private _renderOther(renderer: WebGLRenderer){
        this._changeBeforeRenderOther();
        this._renderWithRenderer(renderer,  null)
        this._recoverVisibleCache()
   }

    
    /**
    * 恢复旧的设置
    */
    private _recoverOldRendererSetting(renderer:WebGLRenderer){ 
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
        this._sceneClassify()
        this._cacheOldRendererSetting(renderer)
        this._renderMesh(renderer)
        // this._renderEdge(renderer)
        // this._renderOther(renderer)
        this._recoverOldRendererSetting(renderer)
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
    * 直接使用渲染器渲染,不清空
    */
    private _renderWithRenderer(renderer: WebGLRenderer, material:Material | null) {
        const currentSceneBackground = this._scene.background;
        this._scene.background = null
        this._scene.overrideMaterial = material;
        renderer.render(this._scene, this._camera);
        this._scene.background = currentSceneBackground
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
    * 渲染Mesh前处理
    */
    private _changeBeforeRenderMesh() {
        const {topoMeshList, topoEdgeList,otherTopoList,otherHelperList} = this._sceneClassification
        if(!this._colored) {
            topoMeshList.forEach(_=>{
              this._visibleCache.set(_, _.visible);
              _.visible = false;
            })
        }
        if(!this._edge) {
            topoEdgeList.forEach(_=>{
                this._visibleCache.set(_, _.visible);
              _.visible = false;
            })
        }
    }

    /**
    * 渲染线前处理
    */
    private _changeBeforeRenderEdge() {
            const {topoMeshList, topoEdgeList,otherTopoList} = this._sceneClassification
            topoMeshList.forEach(_=>{
                this._visibleCache.set(_,_.visible)
                _.visible = false 
            })
            otherTopoList.forEach(_=>{
                this._visibleCache.set(_,_.visible)
                _.visible = false
            })
            if(!this._edge){
                topoEdgeList.forEach(_=>{
                    this._visibleCache.set(_,_.visible)
                    _.visible = false
                })
            }
    }


    /**
    * 渲染场景其它物体前处理
    */
   private _changeBeforeRenderOther(){
        const {topoMeshList, topoEdgeList} = this._sceneClassification
        topoMeshList.forEach(_=>{
            this._visibleCache.set(_,_.visible)
            _.visible = false
        })
        topoEdgeList.forEach(_=>{
            this._visibleCache.set(_,_.visible)
            _.visible = false
        })
   }

    /**
    * visible缓存回写并清空
    */
    private _recoverVisibleCache(){
        this._visibleCache.forEach((visible, obj)=>{
            obj.visible = visible
        })
        this._visibleCache.clear();
    }

    /**
    * 设置是否显示
    */
    // private _setTransparent(transparent:boolean){
    //     this._transparent = transparent
    //     this._sceneClassification.topoMeshList.forEach(_=>{
    //         const mat =  (_.material as Material)
    //         mat.transparent = transparent;
    //         mat.opacity = transparent ? 0.5 : 1;
    //     })
    // }

    /**
    * 设置渲染模式
    */
   public setRenderMode(mode:EN_RENDER_MODE) {
        switch (mode) {
            case EN_RENDER_MODE.colorMode:
                this._colored = true;
                this._edge = false;
                this._transparent = false;
                break;
            case EN_RENDER_MODE.edgeMode:
                this._colored = false;
                this._edge = true;
                this._transparent = false;
                break;
            case EN_RENDER_MODE.edgeColorMode:
                this._colored = true;
                this._edge = true;
                this._transparent = false;
                break;
            
            case EN_RENDER_MODE.translucentMode:
                this._colored = true;
                this._edge = true;
                this._transparent = true;
                break;
        }
   }


   dispose() {
        this._whiteMeshMat?.dispose()
        this._copyMaterial.dispose()
        this._outputRT.dispose();
		this._fsQuad.dispose();
	}

	setSize( width: number, height:number ) {
        this._resolution.set(width * window.devicePixelRatio, height * window.devicePixelRatio)
        this._outputRT.setSize(this._resolution.x, this._resolution.y)
	}
}