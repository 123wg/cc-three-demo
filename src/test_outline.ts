

import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import './index.css'
import { AmbientLight, AxesHelper, BoxGeometry, BufferAttribute, BufferGeometry, Color, DirectionalLight, DoubleSide, Float32BufferAttribute, GridHelper, Group, Mesh, MeshBasicMaterial, MeshPhongMaterial, Object3D, OrthographicCamera, PerspectiveCamera, Points, PointsMaterial, Scene, Vector3, WebGLRenderer } from 'three'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { box_edge, box_face, circle_edge, circle_face, cylinder_edge, cylinder_face, surface_edge, surface_face } from './outline_data';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import {OutlinePass} from './outlinepass'
import { Vector2 } from 'three';
// import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { OutputPass } from './outpass';
import { CCPass } from './new_outline_pass';
import { renderState } from './renderState';

class Canvas {
  public scene:Scene
  camera: OrthographicCamera;
  renderer: WebGLRenderer;
  controls: TrackballControls;
  directionalLight:DirectionalLight
  composer: EffectComposer;
  faces:Mesh[] = []
  edges:LineSegments2[] = []
  
    constructor(){
        const scene = new Scene();
        this.scene = scene

        // 3. 设置正交相机
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = 1000; // 视锥体大小，可根据需求调整
        const camera = new OrthographicCamera(
          (frustumSize * aspect) / -2, // left
          (frustumSize * aspect) / 2,  // right
          frustumSize / 2,             // top
          frustumSize / -2,            // bottom
          1,                         // 近剪裁面
          100000                         // 远剪裁面
        );
        camera.position.set(0, -1000, 200); // 设置相机位置
        camera.lookAt(0, 0, 0);       // 指向场景中心
        
        this.camera = camera


       

        // 4. 创建渲染器
        const renderer = new WebGLRenderer({ 
            antialias: true,
            alpha: true,
            // logarithmicDepthBuffer:true
        });

        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        document.body.appendChild(renderer.domElement);
        this.renderer = renderer
         // 可选：设置清空颜色（背景）
        this.renderer.setClearColor(0xffffff);

        this.controls = new TrackballControls(this.camera, this.renderer.domElement);
        this.controls.rotateSpeed = 5.0;
        this.controls.zoomSpeed = 1.2;
        this.controls.panSpeed = 0.8;
        this.controls.staticMoving = true;
        this.controls.dynamicDampingFactor = 0.3;
       
       // 添加光源：环境光 + 平行光
        const ambientLight = new AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        
        const directionalLight = new DirectionalLight(0xffffff, 1);
        directionalLight.position.copy(this.camera.position)
        this.directionalLight = directionalLight
        this.scene.add(directionalLight);

        const axesHelper = new AxesHelper(500); // 数字表示坐标轴长度
        // axesHelper.renderOrder=1
        scene.add(axesHelper);

        // 6. 添加地面网格
        // const gridHelper = new GridHelper(20,20);
        // gridHelper.rotation.x = Math.PI / 2;
        // this.scene.add(gridHelper);

        this.controls.addEventListener('change',()=>{
            this.directionalLight.position.copy(this.camera.position)
        })

        this.onResize();

        this.addObject()

        this.initComposer();

        this.animate();
    }

    initComposer(){
        const composer = new EffectComposer(this.renderer);
        const resolution = new Vector2(window.innerWidth * window.devicePixelRatio, window.innerHeight * window.devicePixelRatio)
        const ccPass = new CCPass({
            scene: this.scene,
            camera: this.camera,
            resolution,
            mode:renderState.renderMode
        });
        composer.addPass(ccPass)
        this.composer = composer
    }

    private animate = ()=> {
        requestAnimationFrame(this.animate);
        this.controls.update()
        if(this.composer) {
            this.composer.render()
        }else {
            this.renderer.render(this.scene, this.camera);
        }
    }

    onResize(){
        const onWindowResize = (): void => {
            const frustumSize = 20;
            const w: number = window.innerWidth;
            const h: number = window.innerHeight;
            const aspectNew: number = w / h;
           
            if(this.camera instanceof PerspectiveCamera) {
               this.camera.aspect = aspectNew;
            }else {
              this.camera.left = (frustumSize * aspectNew) / -2;
              this.camera.right = (frustumSize * aspectNew) / 2;
              this.camera.top = frustumSize / 2;
              this.camera.bottom = frustumSize / -2;
              // this.camera.updateProjectionMatrix();
            }
           
            this.camera.updateProjectionMatrix();

            this.renderer.setSize(w, h);
        } 
        window.addEventListener('resize', onWindowResize);
    }


    // 加一些测试物体到场景中
    addObject() {
        
        const meshMat = new MeshPhongMaterial({
            color:new Color(0.6653872982754769,0.6653872982754769,0.6653872982754769),
            side: DoubleSide,
            emissive: 0x000000,
            emissiveIntensity: 0.0,
            specular: 0x444444,
            shininess: 50
        })

        const edgeMaterial = new LineMaterial({
            linewidth: 1,
            color: 0x000000,
            side: DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -4,
            polygonOffsetUnits: -20,
        });
        const facesData = [box_face, cylinder_face, circle_face,surface_face]
        const edgeData = [box_edge, cylinder_edge, circle_edge,surface_edge]
        facesData.forEach(fJson=>{
            const faceFata = JSON.parse(fJson)
            let buff = new BufferGeometry();
            buff.setAttribute("position", new Float32BufferAttribute(faceFata.positions, 3));
            buff.setAttribute("normal", new Float32BufferAttribute(faceFata.normals, 3));
            buff.setAttribute("uv", new Float32BufferAttribute(faceFata.uvs, 2));
            buff.setIndex(faceFata.indices);
            buff.computeBoundingBox();
            const face = new Mesh(buff, meshMat);
            this.faces.push(face)
            this.scene.add(face)
        })


        edgeData.forEach(eJson=>{
            const edgeData = JSON.parse(eJson)
            let buff = new LineSegmentsGeometry();
            buff.setPositions(edgeData.positions);
            buff.computeBoundingBox();

            const edge = new LineSegments2(buff, edgeMaterial);
            edge.renderOrder = 999

            this.edges.push(edge)
            this.scene.add(edge);
        })

    }
}


const canvas = new Canvas()
console.log(canvas);
