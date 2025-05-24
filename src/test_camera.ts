
// import { StrictMode } from 'react'
// import { createRoot } from 'react-dom/client'
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import './index.css'
// import App from './App.jsx'

// createRoot(document.getElementById('root')).render(
//   <StrictMode>
//     <App />
//   </StrictMode>,
// )

import { AmbientLight, AxesHelper, BoxGeometry, BufferAttribute, BufferGeometry, Color, DirectionalLight, DoubleSide, GridHelper, Group, Mesh, MeshBasicMaterial, Object3D, OrthographicCamera, PerspectiveCamera, Points, PointsMaterial, Scene, Vector3, WebGLRenderer } from 'three'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
// import { TrackballControls } from './trackballControl';
class Canvas {
  public scene:Scene
  camera: OrthographicCamera | PerspectiveCamera;
  renderer: WebGLRenderer;
  controls: TrackballControls;
  
    constructor(){
        const scene = new Scene();
        this.scene = scene
        // 可选：设置场景背景颜色（非黑色）
        // this.scene.background = new Color(0xffffff);

        // 3. 设置正交相机
        const aspect = window.innerWidth / window.innerHeight;
        const frustumSize = 20; // 视锥体大小，可根据需求调整
        const camera = new OrthographicCamera(
          (frustumSize * aspect) / -2, // left
          (frustumSize * aspect) / 2,  // right
          frustumSize / 2,             // top
          frustumSize / -2,            // bottom
          0.1,                         // 近剪裁面
          1000                         // 远剪裁面
        );
        camera.position.set(0, -15, 3); // 设置相机位置
        camera.lookAt(0, 0, 0);       // 指向场景中心


        // const camera = new PerspectiveCamera(
        //   75,
        //   window.innerWidth / window.innerHeight,
        //   0.1,
        //   1000
        // )
        // // camera.up.set(0,0,1)
        // camera.position.set(0, -15, 3);
        // camera.lookAt(0, 0, 0);

        // console.log(camera.up);
        
        this.camera = camera


       

        // 4. 创建渲染器
        const renderer = new WebGLRenderer({ antialias: true });
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

        const directionalLight = new DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 7.5);
        this.scene.add(directionalLight);

        const axesHelper = new AxesHelper(5); // 数字表示坐标轴长度
        axesHelper.renderOrder=1
        scene.add(axesHelper);

        // 6. 添加地面网格
        const gridHelper = new GridHelper(20,20);
        gridHelper.rotation.x = Math.PI / 2;
        this.scene.add(gridHelper);

        this.animate()

        this.onResize();


        this.testSprite()

        // this.testBox()

    }

    testBox(){
      const obj = new Object3D();
      const box = new Mesh(new BoxGeometry(4, 4, 4), new MeshBasicMaterial({
        color:0x12bff21
      }));
      obj.add(box);
      // 缩放容器
      obj.scale.set(0.5, 0.5, 0.5);
      obj.position.set(5,0,0)

      

      this.scene.add(obj)
    }


    // 测试精灵
    testSprite(){

        // 先画条线
        const s = new Vector3(0,0,0)
        const e = new Vector3(2,2,2)

        const center = new Vector3().addVectors(s,e).multiplyScalar(0.5)
        const offset = new Vector3(1,1,0)
        const sc = center.clone().add(offset)

        let buff = new LineSegmentsGeometry();
        buff.setPositions([...s.toArray(),...e.toArray()]);
        buff.computeBoundingBox();
        const lineMat = new LineMaterial({
                linewidth: 1,
                color:0x000000,
                side: DoubleSide,
                polygonOffset: true,
                polygonOffsetFactor: -2,
                polygonOffsetUnits: -2,
        });

        const line1 = new LineSegments2(buff, lineMat);


        const group = new Group()

        const obj = new Object3D()
        obj.matrixAutoUpdate = false
        obj.add(line1)
        // line1.position.set(-center.x,-center.y,-center.z)
        // obj.position.set(center.x,center.y,center.z)
        // obj.scale.set(0.5,0.5,0.5)

        group.add(obj)

        this.scene.add(obj)
        // 线旁边画个spritess
        // 测试缩放效果


        // 创建个点显示终点
        const geometry = new BufferGeometry();
        const vertices = new Float32Array([...e.toArray(),...center.toArray()]); // 点的位置
        geometry.setAttribute('position', new BufferAttribute(vertices, 3));
          const point = new Points(geometry, new PointsMaterial({
            color: 0xff0000,
            size: 5,
            sizeAttenuation:false
        }))
        this.scene.add(point)


        this.controls.addEventListener('change',()=>{
            console.log('相机缩放值为');
            console.log(this.camera.zoom);
            const zoom = this.camera.zoom
            obj.scale.set(1/zoom,1/zoom,1/zoom)

        })
    }

    private animate = ()=> {
          requestAnimationFrame(this.animate);
          this.controls.update()
          this.renderer.render(this.scene, this.camera);
    }

    onResize(){
        const onWindowResize = (): void => {
          const frustumSize = 10;
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


}


const canvas = new Canvas()
console.log(canvas);
