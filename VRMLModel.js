/**
 An **VRMLModel** is a {{#crossLink "Model"}}{{/crossLink}} that loads itself from VRML files.

 ## Overview

 * Begins loading as soon as you set its {{#crossLink "VRMLModel/src:property"}}{{/crossLink}} property to the location of an OBJ file.
**/
{

    xeogl.VRMLModel = class xeoglVRMLModel extends xeogl.Model {


        init(cfg) {
            super.init(cfg);
            this._src = null;
            this.src = cfg.src;
        }


        /**
         Path to an VRML file.

         You can set this to a new file path at any time (except while loading), which will cause the VRMLModel to load components from
         the new file (after first destroying any components loaded from a previous file path).

         Fires a {{#crossLink "VRMLModel/loaded:event"}}{{/crossLink}} event when the VRML has loaded.

         @property src
         @type String
         */
        set src(value) {
            if (!value) {
                return;
            }
            if (!xeogl._isString(value)) {
                this.error("Value for 'src' should be a string");
                return;
            }
            if (value === this._src) { // Already loaded this VRMLModel

                /**
                 Fired whenever this VRMLModel has finished loading components from the VRML file
                 specified by {{#crossLink "VRMLModel/src:property"}}{{/crossLink}}.
                 @event loaded
                 */
                this.fire("loaded", true, true);
                return;
            }
            this.clear();
            this._src = value;
            xeogl.VRMLModel.load(this, this._src, this._options);
        }

        get source() {
            return this._src;
        }


        destroy() {
            this.destroyAll();
            super.destroy();
        }


        /**
         * Loads VRML from a URL into a {{#crossLink "Model"}}{{/crossLink}}.
         *
         * @method load
         * @static
         * @param {Model} model Model to load into.
         * @param {String} src Path to VRML file.
         * @param {Function} [ok] Completion callback.
         * @param {Function} [error] Error callback.
         */
        static load(model, src, ok, error) {
			//to be done , zip file with jszip
            var spinner = model.scene.canvas.spinner;
            spinner.processes++;
            load(model, src, function () {
                    spinner.processes--;
                    xeogl.scheduleTask(function () {
                        model.fire("loaded", true, true);
                    });
                    if (ok) {
                        ok();
                    }
                },
                function (msg) {
                    spinner.processes--;
                    model.error(msg);
                    if (error) {
                        error(msg);
                    }
                    /**
                     Fired whenever this VRMLModel fails to load the STL file
                     specified by {{#crossLink "VRMLModel/src:property"}}{{/crossLink}}.
                     @event error
                     @param msg {String} Description of the error
                     */
                    model.fire("error", msg);
                });
        }

        /**
         * Parses OBJ and MTL text strings into a {{#crossLink "Model"}}{{/crossLink}}.
         *
         * @method parse
         * @static
         * @param {Model} model Model to load into.
         * @param {String} vrmlData text string.
         * @param {String} [basePath] Base path for external resources.
         */
        static parse(model, vrmlData, basePath) {
            if (!vrmlData) {
                this.warn("load() param expected: vrmlData");
                return;
            }
            var state = parse(model, vrmlData, null);

            createMeshes(model, state);
            model.src = null;
            model.fire("loaded", true, true);
        }
    };

//--------------------------------------------------------------------------------------------
// Loads VRML
//
// Use https://github.com/bartmcleod/VrmlParser libs
//
// Originally based on the THREE.js VRML loaders: 
//
// https://github.com/mrdoob/three.js/blob/dev/examples/js/loaders/OBJLoader.js
// https://github.com/mrdoob/three.js/blob/dev/examples/js/loaders/MTLLoader.js
// https://github.com/mrdoob/three.js/blob/dev/examples/js/loaders/VRMLLoader.js
// 
//--------------------------------------------------------------------------------------------

    var load = function (model, url, ok) {

        loadFile(url, function (text) {
                var state = parse(text, model, url);
                ok(state);
            },
            function (error) {
                model.error(error);
            });
    };

	function parse(data, model, options) {		

        const WebGLConstants = {
            34963: 'ELEMENT_ARRAY_BUFFER',  //0x8893
            34962: 'ARRAY_BUFFER',          //0x8892
            5123: 'UNSIGNED_SHORT',         //0x1403
            5126: 'FLOAT',                  //0x1406
            4: 'TRIANGLES',                 //0x0004
            35678: 'SAMPLER_2D',            //0x8B5E
            35664: 'FLOAT_VEC2',            //0x8B50
            35665: 'FLOAT_VEC3',            //0x8B51
            35666: 'FLOAT_VEC4',            //0x8B52
            35676: 'FLOAT_MAT4'             //0x8B5C
        };

        const WEBGL_COMPONENT_TYPES = {
            5120: Int8Array,
            5121: Uint8Array,
            5122: Int16Array,
            5123: Uint16Array,
            5125: Uint32Array,
            5126: Float32Array
        };

        const WEBGL_TYPE_SIZES = {
            'SCALAR': 1,
            'VEC2': 2,
            'VEC3': 3,
            'VEC4': 4,
            'MAT2': 4,
            'MAT3': 9,
            'MAT4': 16
        };
		var defines = {};
		
		function addShape(data,parent,model) {			
			var mat = loadMaterial(data,parent,model);
			var geometry = getGeometry(data.geometry);//loadGeometry(data,parent,model);
			if (geometry && mat) {
				return new xeogl.Mesh({
					geometry:geometry,
					material:mat
				});	
			} else if (geometry) {
				return new xeogl.Mesh({
					geometry:geometry
				});
			}
		}
		
		function loadGeometry(data,parent,model) {		
			var geometrysInfo = data.geometry;
			if (geometrysInfo) {
				if (Array.isArray(geometrysInfo)){
					// group?
					for (var i = 0, len = materialsInfo.length; i < len; i++) {
						var geometry = getGeometry(geometrysInfo[i]);
					}
				} else {
					return getGeometry(geometrysInfo);
				}
			}			
		}
		
		function getGeometry(data) {
			console.log("Shape as : "+ data.node);
			if ( data.node === 'Box' ) {
				var s = data.size;
				return new xeogl.BoxGeometry({ // Half-size on each axis; BoxGeometry is actually two units big on each side.
				   xSize: s.x/2, 
				   ySize: s.y/2,
				   zSize: s.z/2
				});
			} else if (data.node === 'Cylinder') { //data.radius, data.radius, data.height
				return new xeogl.CylinderGeometry({
					radiusTop: data.radius,
					radiusBottom: data.radius,
					height:  data.height
				});
			} else if (data.node === 'Cone') {
				return new xeogl.CylinderGeometry({
					radiusTop: data.topRadius,
					radiusBottom: data.bottomRadius,
					height:  data.height
				});				
			} else if (data.node === 'Sphere') {
				return new xeogl.SphereGeometry({
					radius: data.radius,
				});				
			} else if (data.node === 'PointSet') {	//To be test
				var positions = [];
				var indices = []; 
				if (data.coord) {
					for (var i = 0; i < data.coord.point.length; i ++ ) {
						positions.push(data.coord.point[i].x,data.coord.point[i].y,data.coord.point[i].z);
					}
					indices = data.coordIndex.toString().split(",");
					return new xeogl.Geometry({
						primitive: "points",
						positions: positions,
						indices: indices
					});
				}
			} else if (data.node === 'IndexedLineSet') {	//To be test
				var positions = [];
				var indices = []; 
				if (data.coord) {
					for (var i = 0; i < data.coord.point.length; i ++ ) {
						positions.push(data.coord.point[i].x,data.coord.point[i].y,data.coord.point[i].z);
					}
					indices = data.coordIndex.toString().split(",");
					return new xeogl.Geometry({
						primitive: "lines",
						positions: positions,
						indices:  indices
					});
				}
			} else if (data.node === 'IndexedFaceSet') {	//To be done			
				var normals = data.normalIndex;
				var colors = data.colorIndex;
				var positions = [];
				var indices;
				
				for (var i = 0; i < data.coord.point.length; i ++ ) {
					positions.push(data.coord.point[i].x,data.coord.point[i].y,data.coord.point[i].z);
				}
				
				if (data.ccw === undefined )
					data.ccw = true; 
				indices = data.coordIndex.toString().split(","); 	
				if (data.coordIndex) {
				//	if (data.ccw) {					
						indices = data.coordIndex.toString().split(","); 
				/*	} else {
						indices = data.coordIndex.reverse().toString().split(","); 	
					}*/					
				} else {
					indices = new Int32Array(positions.length / 3);
					for (var ni = 0, len = indices.length; ni < len; ni++) {
						indices[ni] = ni;
					}
				}
	
				if ( data.normalIndex) {
					normals  = data.normalIndex;
				} else {
					normals = indices;
				}
				//normals = normals && normals.length > 0 ? normals : null;
				colors = colors && colors.length > 0 ? colors : null;

				if (false) {
					xeogl.math.faceToVertexNormals(positions, normals);
				}
				
				var primitive = "triangles";
				/*if (data.solid && data.solid===true )
					primitive = "triangle-strip";*/
					
				return new xeogl.Geometry({
					primitive: primitive,
					positions: positions,
					//normals: normals,
					// autoVertexNormals: !normals,
					//colors: colors,
					indices: indices
				});
				// some shapes only have vertices for use in other shapes
				/*if (data.coordIndex) {
					var newPositions = [];
					var newUvs = [];
					position = {x:0,y:0,z:0};
					uv = {x:0,y:0};
					for ( i = 0, il = data.coordIndex.length; i < il; i ++ ) {
						var indexes = data.coordIndex[ i ];
						// VRML support multipoint indexed face sets (more then 3 vertices). You must calculate the composing triangles here
						skip = 0;
						while ( indexes.length >= 3 && skip < ( indexes.length - 2 ) ) {
							if (data.ccw === undefined )
								data.ccw = true; // ccw is true by default
							var i1 = indexes[ 0 ];
							var i2 = indexes[ skip + ( data.ccw ? 1 : 2 ) ];
							var i3 = indexes[ skip + ( data.ccw ? 2 : 1 ) ];
							// create non indexed geometry, necessary for face normal generation
							newPositions.push( position.x + i1 * 3, position.y + i1 * 3, position.z + i1 * 3 );
							newPositions.push( position.x + i2 * 3, position.y + i2 * 3, position.z + i2 * 3 );
							newPositions.push( position.x + i3 * 3, position.y + i3 * 3, position.z + i3 * 3 );							
							newUvs.push( uv.x + i1 * 2, uv.y + i1 * 2);
							newUvs.push( uv.x + i2 * 2, uv.y + i2 * 2 );
							newUvs.push( uv.x + i3 * 2, uv.y + i3 * 2);
							skip ++;
						}
					}
					positions = newPositions;
					uvs = newUvs;
				} 
				
				return new xeogl.Geometry({
				// The primitive type - allowed values are
				// "points", "lines", "line-loop", "line-strip",
				// "triangles", "triangle-strip" and "triangle-fan".
				//
				// See the OpenGL/WebGL specification docs for
				// how the coordinate arrays are supposed to be laid out.
				primitive: "triangles",
				// The vertices - eight for our cube, each
				// one spanning three array elements for X,Y and Z
				positions: positions,
				// Normal vectors, one for each vertex
				//normals: [
				//],
				// UV coords
				uv: uvs,
				// Color for each vertex
				//colors: [
				//],
				// Indices - these organise the
				// positions and uv texture coordinates
				// into geometric primitives in accordance
				// with the "primitive" parameter,
				// in this case a set of three indices
				// for each triangle.
				//
				// Note that each triangle is specified
				// in counter-clockwise winding order.
				//
				// You can specify them in clockwise
				// order if you configure the Material
				// frontface property as "cw", instead
				// of the default "ccw".
				//indices: 
				});*/
			}
		}		
	
		function parseIndexedFaceSet(node){
			var indexes, uvIndexes, uvs;
			var vec;
			var vertices = [];
			var faces = [];
			var faceVertexUvs = [];
			if ( data.texCoord) {
				uvs = node.texCoord.point;
			}

			if ( node.coord) {
				if ( ! uvs ) {
					uvs = node.coord.point;
				}
				for ( var k = 0, l = node.coord.point.length; k < l; k ++ ) {
					var point = node.coord.point[ k ];
					vec = [point.x, point.y, point.z];
					vertices.push(vec);
				}
			}

			var skip = 0;
			// some shapes only have vertices for use in other shapes
			if ( node.coordIndex ) {
				// read this: http://math.hws.edu/eck/cs424/notes2013/16_Threejs_Advanced.html
				for ( var i = 0, j = node.coordIndex.length; i < j; i ++ ) {
					indexes = node.coordIndex[ i ];
					if ( node.texCoordIndex) {
						uvIndexes = node.texCoordIndex[ i ];
					} else {
						// default texture coord index
						uvIndexes = indexes;
					}
					// vrml supports multipoint indexed face sets (more then 3 vertices). You must calculate the composing triangles here
					skip = 0;
					// @todo: see if your can support squares, because they are possible in THREE (if you do, duplicator must also support them!!)
					// Face3 only works with triangles, but IndexedFaceSet allows shapes with polygons: triangulate them
					while ( indexes.length >= 3 && skip < ( indexes.length - 2 ) ) {
						var a = indexes[ 0 ];
						var b = indexes[ skip + (node.ccw ? 1 : 2) ];
						var c = indexes[ skip + (node.ccw ? 2 : 1) ];
						var face = [
							a,
							b,
							c,
							null // normal, will be added later
							// todo: pass in the color, if a color index is present
						];
						//this.log(face);
						// @todo: this code might have to move till after vertices have been duplicated for sharp edge rendering
						if ( uvs && uvIndexes ) {
							faceVertexUvs.push([
								[
									uvs[ uvIndexes[ 0 ] ].x,
									uvs[ uvIndexes[ 0 ] ].y
								],
								[
									uvs[ uvIndexes[ skip + (node.ccw ? 1 : 2) ] ].x,
									uvs[ uvIndexes[ skip + (node.ccw ? 1 : 2) ] ].y
								],
								[
									uvs[ uvIndexes[ skip + (node.ccw ? 2 : 1) ] ].x,
									uvs[ uvIndexes[ skip + (node.ccw ? 2 : 1) ] ].y
								]
							]);
						} else {
							//this.log('Missing either uvs or indexes');
						}
						skip ++;
						faces.push(face);

					}

				}

			}

			var creaseAngle = node.creaseAngle ? node.creaseAngle : false;

			// if no creaseAngle, the VRML author probably wasn't intersted in smooth rendering, so don't!
			if ( false !== creaseAngle ) {
				//smooth.smooth(object, creaseAngle);
				//xeogl.math.faceToVertexNormals(positions, creaseAngle);
			} else {
				// only compute face normals, perform no smoothing
				//object.computeFaceNormals();
			}			
			if (Array.isArray(vertices))
				vertices.join().split(",");
			if (Array.isArray(faces))
				faces.join().split(",");
			if (Array.isArray(indexes))
				indexes.join().split(",");
			if (indexes && indexes.lenght > 0) 
			return new xeogl.Geometry(model, {
				primitive: "triangles",
				positions: vertices,
				normals: faces,
				// autoVertexNormals: !normals,
				//colors: colors,
				indices: indexes
			});
			//object.computeBoundingSphere();
		}
		
		
		function loadMaterial(data,parent,model) {
			var appearance = data.appearance; //child??
			if (appearance) {
				var materialsInfo = appearance.material;
				var material;
				if (materialsInfo) {
					if (Array.isArray(materialsInfo)){
						for (var i = 0, len = materialsInfo.length; i < len; i++) {
							material = loadMaterialColorize(materialInfo[i]); //As option? is not use specularColor						
							parent.addChild(material);
							model._addComponent(material);						
						}
					} else {
						return loadMaterialColorize(materialsInfo); //As option? is not use specularColor							
					}
				}
			}			
			//ImageTexture tbd
		}
		
		function loadMaterialColorize(materialInfo) {
			var mat = new xeogl.LambertMaterial();					
            if (materialInfo.diffuseColor){
				mat.color =   [materialInfo.diffuseColor.x,materialInfo.diffuseColor.y, materialInfo.diffuseColor.z]
			}
			
			if (materialInfo.emissiveColor){
				mat.emissive =   [materialInfo.emissiveColor.x,materialInfo.emissiveColor.y, materialInfo.emissiveColor.z]
			}
			
			if (materialInfo.transparency) {
				mat.alpha = materialInfo.transparency;
			}
			
			if ( materialInfo.string ) {
				defines[ materialInfo.string ] = mat;
			}	
			return mat;
        }
		
		function parseNode(data,parent,model) {
			console.log("Parse an node " + data.node);
			var object = parent;
			switch(data.node) {
				case 'Transform' :
				case 'Group' :
					object = new xeogl.Group();
					if (data.translation) {
						var t = data.translation;
						object.position = [ t.x, t.y, t.z ];
					}
					if (data.rotation) {
						var r = data.rotation;
						object.quaternion= [ r.x, r.y, r.z , r.w ];
					}
					if (data.scale) {
						var s = data.scale;
						object.scale = [ s.x, s.y, s.z ];
					}
					if (data.name) {
						object.id = data.name;
						defines[ object.id ] = object;
					}
					parent.addChild(object, false); // Don't automatically inherit properties
					model._addComponent(object);
					break;
				case 'Shape':
					object = addShape(data,parent,model);
					if (object) {
						parent.addChild(object, false);
						model._addComponent(object);
					}
					break;				
				case 'Light':
				case 'AmbientLight':
				case 'PointLight':
				case 'Background':
				case "OrientationInterpolator":
				case "PositionInterpolator":
				case "Viewpoint":
				case "NavigationInfo":
				case "Text":
				case "Inline":
				case "Switch":
				case "TimeSensor":
				case "TouchSensor":
				default:
					console.warn(data.node + " type node is not implemented")
					break;
			}
			if (data.children) {
				for ( var i = 0, l = data.children.length; i < l; i ++ ) {
					parseNode( data.children[ i ], object,model );
				}
			}
		}

		// Action
		model.clear();
		var tree = vrmlParser.parse(data);
		//var lines = parseLines(data);
		console.log(tree);
		for ( var i = 0, l = tree.length; i < l; i ++ ) {
			parseNode(tree[i],model,model);
		}

       // return ;

    }


//--------------------------------------------------------------------------------------------
// Creates meshes from parsed state
//--------------------------------------------------------------------------------------------

    var createMeshes = (function () {

        return function (model, state) {

            for (var j = 0, k = state.objects.length; j < k; j++) {

                var object = state.objects[j];
                var geometry = object.geometry;
                var isLine = ( geometry.type === 'Line' );

                if (geometry.positions.length === 0) {
                    // Skip o/g line declarations that did not follow with any faces
                    continue;
                }

                var geometryCfg = {
                    primitive: "triangles"
                };

                geometryCfg.positions = geometry.positions;

                if (geometry.normals.length > 0) {
                    geometryCfg.normals = geometry.normals;
                } else {
                    geometryCfg.autoVertexNormals = true;
                }

                if (geometry.uv.length > 0) {
                    geometryCfg.uv = geometry.uv;
                }

                var indices = new Array(geometryCfg.positions.length / 3); // Triangle soup
                for (var idx = 0; idx < indices.length; idx++) {
                    indices[idx] = idx;
                }
                geometryCfg.indices = indices;

                var xeoGeometry = new xeogl.Geometry(model, geometryCfg);
                model._addComponent(xeoGeometry);

                var materialId = object.material.id;
                var material;
                if (materialId && materialId !== "") {
                    material = model.scene.components[materialId];
                    if (!material) {
                        model.error("Material not found: " + materialId);
                    }
                } else {
                    material = new xeogl.PhongMaterial(model, {
                        //emissive: [0.6, 0.6, 0.0],
                        diffuse: [0.6, 0.6, 0.6],
                        backfaces: true
                    });
                    model._addComponent(material);
                }

                // material.emissive = [Math.random(), Math.random(), Math.random()];

                var mesh = new xeogl.Mesh(model, {
                    id: model.id + "#" + object.id,
                    geometry: xeoGeometry,
                    material: material,
                    pickable: true
                });

                model.addChild(mesh);
                model._addComponent(mesh);
            }
        };
    })();

    function loadFile(url, ok, err) {
        var request = new XMLHttpRequest();
        request.open('GET', url, true);
        request.addEventListener('load', function (event) {
            var response = event.target.response;
            if (this.status === 200) {
                if (ok) {
                    ok(response);
                }
            } else if (this.status === 0) {
                // Some browsers return HTTP Status 0 when using non-http protocol
                // e.g. 'file://' or 'data://'. Handle as success.
                console.warn('loadFile: HTTP Status 0 received.');
                if (ok) {
                    ok(response);
                }
            } else {
                if (err) {
                    err(event);
                }
            }
        }, false);

        request.addEventListener('error', function (event) {
            if (err) {
                err(event);
            }
        }, false);
        request.send(null);
    }
}