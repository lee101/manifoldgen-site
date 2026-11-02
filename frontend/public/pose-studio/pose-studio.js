(()=>{var lJ="179";var dJ=0,V9=1,mJ=2;var B9=1,uJ=2,U5=3,Y5=0,c1=1,n1=2,v5=0,K6=1,I9=2,C9=3,_9=4,cJ=5,_8=100,nJ=101,sJ=102,oJ=103,iJ=104,rJ=200,aJ=201,tJ=202,eJ=203,$M=204,JM=205,MM=206,QM=207,HM=208,kM=209,KM=210,wM=211,WM=212,EM=213,ZM=214,H$=0,k$=1,A8=2,w6=3,K$=4,w$=5,W$=6,E$=7,RM=0,UM=1,YM=2,I5=0,NM=1,XM=2,GM=3,DM=4,qM=5,OM=6,FM=7;var S8=301,a5=302,Z$=303,R$=304,W6=306,LM=1000,PM=1001,zM=1002,s1=1003,VM=1004;var E6=1005;var t5=1006,U$=1007;var T8=1008;var N5=1009,BM=1010,IM=1011,Z6=1012,A9=1013,h8=1014,b5=1015,R6=1016,S9=1017,T9=1018,f8=1020,CM=35902,_M=1021,AM=1022,J5=1023,Y$=1026,U6=1027,SM=1028,h9=1029,TM=1030,f9=1031;var y9=1033,N$=33776,X$=33777,G$=33778,D$=33779,j9=35840,v9=35841,b9=35842,p9=35843,x9=36196,g9=37492,l9=37496,d9=37808,m9=37809,u9=37810,c9=37811,n9=37812,s9=37813,o9=37814,i9=37815,r9=37816,a9=37817,t9=37818,e9=37819,$7=37820,J7=37821,q$=36492,M7=36494,Q7=36495,hM=36283,H7=36284,k7=36285,K7=36286;var fM=3201;var yM=0,jM=1,e5="",vM="srgb",Y6="srgb-linear",w7="linear",K1="srgb";var bM=512,pM=513,xM=514,W7=515,gM=516,lM=517,dM=518,mM=519;var E7="300 es",Z7=2000;class p5{addEventListener($,J){if(this._listeners===void 0)this._listeners={};let M=this._listeners;if(M[$]===void 0)M[$]=[];if(M[$].indexOf(J)===-1)M[$].push(J)}hasEventListener($,J){let M=this._listeners;if(M===void 0)return!1;return M[$]!==void 0&&M[$].indexOf(J)!==-1}removeEventListener($,J){let M=this._listeners;if(M===void 0)return;let Q=M[$];if(Q!==void 0){let H=Q.indexOf(J);if(H!==-1)Q.splice(H,1)}}dispatchEvent($){let J=this._listeners;if(J===void 0)return;let M=J[$.type];if(M!==void 0){$.target=this;let Q=M.slice(0);for(let H=0,k=Q.length;H<k;H++)Q[H].call(this,$);$.target=null}}}var I1=["00","01","02","03","04","05","06","07","08","09","0a","0b","0c","0d","0e","0f","10","11","12","13","14","15","16","17","18","19","1a","1b","1c","1d","1e","1f","20","21","22","23","24","25","26","27","28","29","2a","2b","2c","2d","2e","2f","30","31","32","33","34","35","36","37","38","39","3a","3b","3c","3d","3e","3f","40","41","42","43","44","45","46","47","48","49","4a","4b","4c","4d","4e","4f","50","51","52","53","54","55","56","57","58","59","5a","5b","5c","5d","5e","5f","60","61","62","63","64","65","66","67","68","69","6a","6b","6c","6d","6e","6f","70","71","72","73","74","75","76","77","78","79","7a","7b","7c","7d","7e","7f","80","81","82","83","84","85","86","87","88","89","8a","8b","8c","8d","8e","8f","90","91","92","93","94","95","96","97","98","99","9a","9b","9c","9d","9e","9f","a0","a1","a2","a3","a4","a5","a6","a7","a8","a9","aa","ab","ac","ad","ae","af","b0","b1","b2","b3","b4","b5","b6","b7","b8","b9","ba","bb","bc","bd","be","bf","c0","c1","c2","c3","c4","c5","c6","c7","c8","c9","ca","cb","cc","cd","ce","cf","d0","d1","d2","d3","d4","d5","d6","d7","d8","d9","da","db","dc","dd","de","df","e0","e1","e2","e3","e4","e5","e6","e7","e8","e9","ea","eb","ec","ed","ee","ef","f0","f1","f2","f3","f4","f5","f6","f7","f8","f9","fa","fb","fc","fd","fe","ff"];var $9=Math.PI/180,J$=180/Math.PI;function N6(){let $=Math.random()*4294967295|0,J=Math.random()*4294967295|0,M=Math.random()*4294967295|0,Q=Math.random()*4294967295|0;return(I1[$&255]+I1[$>>8&255]+I1[$>>16&255]+I1[$>>24&255]+"-"+I1[J&255]+I1[J>>8&255]+"-"+I1[J>>16&15|64]+I1[J>>24&255]+"-"+I1[M&63|128]+I1[M>>8&255]+"-"+I1[M>>16&255]+I1[M>>24&255]+I1[Q&255]+I1[Q>>8&255]+I1[Q>>16&255]+I1[Q>>24&255]).toLowerCase()}function c0($,J,M){return Math.max(J,Math.min(M,$))}function zH($,J){return($%J+J)%J}function J9($,J,M){return(1-M)*$+M*J}function e8($,J){switch(J.constructor){case Float32Array:return $;case Uint32Array:return $/4294967295;case Uint16Array:return $/65535;case Uint8Array:return $/255;case Int32Array:return Math.max($/2147483647,-1);case Int16Array:return Math.max($/32767,-1);case Int8Array:return Math.max($/127,-1);default:throw Error("Invalid component type.")}}function y1($,J){switch(J.constructor){case Float32Array:return $;case Uint32Array:return Math.round($*4294967295);case Uint16Array:return Math.round($*65535);case Uint8Array:return Math.round($*255);case Int32Array:return Math.round($*2147483647);case Int16Array:return Math.round($*32767);case Int8Array:return Math.round($*127);default:throw Error("Invalid component type.")}}class J1{constructor($=0,J=0){J1.prototype.isVector2=!0,this.x=$,this.y=J}get width(){return this.x}set width($){this.x=$}get height(){return this.y}set height($){this.y=$}set($,J){return this.x=$,this.y=J,this}setScalar($){return this.x=$,this.y=$,this}setX($){return this.x=$,this}setY($){return this.y=$,this}setComponent($,J){switch($){case 0:this.x=J;break;case 1:this.y=J;break;default:throw Error("index is out of range: "+$)}return this}getComponent($){switch($){case 0:return this.x;case 1:return this.y;default:throw Error("index is out of range: "+$)}}clone(){return new this.constructor(this.x,this.y)}copy($){return this.x=$.x,this.y=$.y,this}add($){return this.x+=$.x,this.y+=$.y,this}addScalar($){return this.x+=$,this.y+=$,this}addVectors($,J){return this.x=$.x+J.x,this.y=$.y+J.y,this}addScaledVector($,J){return this.x+=$.x*J,this.y+=$.y*J,this}sub($){return this.x-=$.x,this.y-=$.y,this}subScalar($){return this.x-=$,this.y-=$,this}subVectors($,J){return this.x=$.x-J.x,this.y=$.y-J.y,this}multiply($){return this.x*=$.x,this.y*=$.y,this}multiplyScalar($){return this.x*=$,this.y*=$,this}divide($){return this.x/=$.x,this.y/=$.y,this}divideScalar($){return this.multiplyScalar(1/$)}applyMatrix3($){let J=this.x,M=this.y,Q=$.elements;return this.x=Q[0]*J+Q[3]*M+Q[6],this.y=Q[1]*J+Q[4]*M+Q[7],this}min($){return this.x=Math.min(this.x,$.x),this.y=Math.min(this.y,$.y),this}max($){return this.x=Math.max(this.x,$.x),this.y=Math.max(this.y,$.y),this}clamp($,J){return this.x=c0(this.x,$.x,J.x),this.y=c0(this.y,$.y,J.y),this}clampScalar($,J){return this.x=c0(this.x,$,J),this.y=c0(this.y,$,J),this}clampLength($,J){let M=this.length();return this.divideScalar(M||1).multiplyScalar(c0(M,$,J))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this}negate(){return this.x=-this.x,this.y=-this.y,this}dot($){return this.x*$.x+this.y*$.y}cross($){return this.x*$.y-this.y*$.x}lengthSq(){return this.x*this.x+this.y*this.y}length(){return Math.sqrt(this.x*this.x+this.y*this.y)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)}normalize(){return this.divideScalar(this.length()||1)}angle(){return Math.atan2(-this.y,-this.x)+Math.PI}angleTo($){let J=Math.sqrt(this.lengthSq()*$.lengthSq());if(J===0)return Math.PI/2;let M=this.dot($)/J;return Math.acos(c0(M,-1,1))}distanceTo($){return Math.sqrt(this.distanceToSquared($))}distanceToSquared($){let J=this.x-$.x,M=this.y-$.y;return J*J+M*M}manhattanDistanceTo($){return Math.abs(this.x-$.x)+Math.abs(this.y-$.y)}setLength($){return this.normalize().multiplyScalar($)}lerp($,J){return this.x+=($.x-this.x)*J,this.y+=($.y-this.y)*J,this}lerpVectors($,J,M){return this.x=$.x+(J.x-$.x)*M,this.y=$.y+(J.y-$.y)*M,this}equals($){return $.x===this.x&&$.y===this.y}fromArray($,J=0){return this.x=$[J],this.y=$[J+1],this}toArray($=[],J=0){return $[J]=this.x,$[J+1]=this.y,$}fromBufferAttribute($,J){return this.x=$.getX(J),this.y=$.getY(J),this}rotateAround($,J){let M=Math.cos(J),Q=Math.sin(J),H=this.x-$.x,k=this.y-$.y;return this.x=H*M-k*Q+$.x,this.y=H*Q+k*M+$.y,this}random(){return this.x=Math.random(),this.y=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y}}class m0{constructor($=0,J=0,M=0,Q=1){this.isQuaternion=!0,this._x=$,this._y=J,this._z=M,this._w=Q}static slerpFlat($,J,M,Q,H,k,K){let w=M[Q+0],W=M[Q+1],E=M[Q+2],R=M[Q+3],Z=H[k+0],U=H[k+1],X=H[k+2],G=H[k+3];if(K===0){$[J+0]=w,$[J+1]=W,$[J+2]=E,$[J+3]=R;return}if(K===1){$[J+0]=Z,$[J+1]=U,$[J+2]=X,$[J+3]=G;return}if(R!==G||w!==Z||W!==U||E!==X){let q=1-K,Y=w*Z+W*U+E*X+R*G,N=Y>=0?1:-1,V=1-Y*Y;if(V>Number.EPSILON){let P=Math.sqrt(V),h=Math.atan2(P,Y*N);q=Math.sin(q*h)/P,K=Math.sin(K*h)/P}let D=K*N;if(w=w*q+Z*D,W=W*q+U*D,E=E*q+X*D,R=R*q+G*D,q===1-K){let P=1/Math.sqrt(w*w+W*W+E*E+R*R);w*=P,W*=P,E*=P,R*=P}}$[J]=w,$[J+1]=W,$[J+2]=E,$[J+3]=R}static multiplyQuaternionsFlat($,J,M,Q,H,k){let K=M[Q],w=M[Q+1],W=M[Q+2],E=M[Q+3],R=H[k],Z=H[k+1],U=H[k+2],X=H[k+3];return $[J]=K*X+E*R+w*U-W*Z,$[J+1]=w*X+E*Z+W*R-K*U,$[J+2]=W*X+E*U+K*Z-w*R,$[J+3]=E*X-K*R-w*Z-W*U,$}get x(){return this._x}set x($){this._x=$,this._onChangeCallback()}get y(){return this._y}set y($){this._y=$,this._onChangeCallback()}get z(){return this._z}set z($){this._z=$,this._onChangeCallback()}get w(){return this._w}set w($){this._w=$,this._onChangeCallback()}set($,J,M,Q){return this._x=$,this._y=J,this._z=M,this._w=Q,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._w)}copy($){return this._x=$.x,this._y=$.y,this._z=$.z,this._w=$.w,this._onChangeCallback(),this}setFromEuler($,J=!0){let{_x:M,_y:Q,_z:H,_order:k}=$,K=Math.cos,w=Math.sin,W=K(M/2),E=K(Q/2),R=K(H/2),Z=w(M/2),U=w(Q/2),X=w(H/2);switch(k){case"XYZ":this._x=Z*E*R+W*U*X,this._y=W*U*R-Z*E*X,this._z=W*E*X+Z*U*R,this._w=W*E*R-Z*U*X;break;case"YXZ":this._x=Z*E*R+W*U*X,this._y=W*U*R-Z*E*X,this._z=W*E*X-Z*U*R,this._w=W*E*R+Z*U*X;break;case"ZXY":this._x=Z*E*R-W*U*X,this._y=W*U*R+Z*E*X,this._z=W*E*X+Z*U*R,this._w=W*E*R-Z*U*X;break;case"ZYX":this._x=Z*E*R-W*U*X,this._y=W*U*R+Z*E*X,this._z=W*E*X-Z*U*R,this._w=W*E*R+Z*U*X;break;case"YZX":this._x=Z*E*R+W*U*X,this._y=W*U*R+Z*E*X,this._z=W*E*X-Z*U*R,this._w=W*E*R-Z*U*X;break;case"XZY":this._x=Z*E*R-W*U*X,this._y=W*U*R-Z*E*X,this._z=W*E*X+Z*U*R,this._w=W*E*R+Z*U*X;break;default:console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: "+k)}if(J===!0)this._onChangeCallback();return this}setFromAxisAngle($,J){let M=J/2,Q=Math.sin(M);return this._x=$.x*Q,this._y=$.y*Q,this._z=$.z*Q,this._w=Math.cos(M),this._onChangeCallback(),this}setFromRotationMatrix($){let J=$.elements,M=J[0],Q=J[4],H=J[8],k=J[1],K=J[5],w=J[9],W=J[2],E=J[6],R=J[10],Z=M+K+R;if(Z>0){let U=0.5/Math.sqrt(Z+1);this._w=0.25/U,this._x=(E-w)*U,this._y=(H-W)*U,this._z=(k-Q)*U}else if(M>K&&M>R){let U=2*Math.sqrt(1+M-K-R);this._w=(E-w)/U,this._x=0.25*U,this._y=(Q+k)/U,this._z=(H+W)/U}else if(K>R){let U=2*Math.sqrt(1+K-M-R);this._w=(H-W)/U,this._x=(Q+k)/U,this._y=0.25*U,this._z=(w+E)/U}else{let U=2*Math.sqrt(1+R-M-K);this._w=(k-Q)/U,this._x=(H+W)/U,this._y=(w+E)/U,this._z=0.25*U}return this._onChangeCallback(),this}setFromUnitVectors($,J){let M=$.dot(J)+1;if(M<0.00000001)if(M=0,Math.abs($.x)>Math.abs($.z))this._x=-$.y,this._y=$.x,this._z=0,this._w=M;else this._x=0,this._y=-$.z,this._z=$.y,this._w=M;else this._x=$.y*J.z-$.z*J.y,this._y=$.z*J.x-$.x*J.z,this._z=$.x*J.y-$.y*J.x,this._w=M;return this.normalize()}angleTo($){return 2*Math.acos(Math.abs(c0(this.dot($),-1,1)))}rotateTowards($,J){let M=this.angleTo($);if(M===0)return this;let Q=Math.min(1,J/M);return this.slerp($,Q),this}identity(){return this.set(0,0,0,1)}invert(){return this.conjugate()}conjugate(){return this._x*=-1,this._y*=-1,this._z*=-1,this._onChangeCallback(),this}dot($){return this._x*$._x+this._y*$._y+this._z*$._z+this._w*$._w}lengthSq(){return this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w}length(){return Math.sqrt(this._x*this._x+this._y*this._y+this._z*this._z+this._w*this._w)}normalize(){let $=this.length();if($===0)this._x=0,this._y=0,this._z=0,this._w=1;else $=1/$,this._x=this._x*$,this._y=this._y*$,this._z=this._z*$,this._w=this._w*$;return this._onChangeCallback(),this}multiply($){return this.multiplyQuaternions(this,$)}premultiply($){return this.multiplyQuaternions($,this)}multiplyQuaternions($,J){let{_x:M,_y:Q,_z:H,_w:k}=$,K=J._x,w=J._y,W=J._z,E=J._w;return this._x=M*E+k*K+Q*W-H*w,this._y=Q*E+k*w+H*K-M*W,this._z=H*E+k*W+M*w-Q*K,this._w=k*E-M*K-Q*w-H*W,this._onChangeCallback(),this}slerp($,J){if(J===0)return this;if(J===1)return this.copy($);let M=this._x,Q=this._y,H=this._z,k=this._w,K=k*$._w+M*$._x+Q*$._y+H*$._z;if(K<0)this._w=-$._w,this._x=-$._x,this._y=-$._y,this._z=-$._z,K=-K;else this.copy($);if(K>=1)return this._w=k,this._x=M,this._y=Q,this._z=H,this;let w=1-K*K;if(w<=Number.EPSILON){let U=1-J;return this._w=U*k+J*this._w,this._x=U*M+J*this._x,this._y=U*Q+J*this._y,this._z=U*H+J*this._z,this.normalize(),this}let W=Math.sqrt(w),E=Math.atan2(W,K),R=Math.sin((1-J)*E)/W,Z=Math.sin(J*E)/W;return this._w=k*R+this._w*Z,this._x=M*R+this._x*Z,this._y=Q*R+this._y*Z,this._z=H*R+this._z*Z,this._onChangeCallback(),this}slerpQuaternions($,J,M){return this.copy($).slerp(J,M)}random(){let $=2*Math.PI*Math.random(),J=2*Math.PI*Math.random(),M=Math.random(),Q=Math.sqrt(1-M),H=Math.sqrt(M);return this.set(Q*Math.sin($),Q*Math.cos($),H*Math.sin(J),H*Math.cos(J))}equals($){return $._x===this._x&&$._y===this._y&&$._z===this._z&&$._w===this._w}fromArray($,J=0){return this._x=$[J],this._y=$[J+1],this._z=$[J+2],this._w=$[J+3],this._onChangeCallback(),this}toArray($=[],J=0){return $[J]=this._x,$[J+1]=this._y,$[J+2]=this._z,$[J+3]=this._w,$}fromBufferAttribute($,J){return this._x=$.getX(J),this._y=$.getY(J),this._z=$.getZ(J),this._w=$.getW(J),this._onChangeCallback(),this}toJSON(){return this.toArray()}_onChange($){return this._onChangeCallback=$,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._w}}class A{constructor($=0,J=0,M=0){A.prototype.isVector3=!0,this.x=$,this.y=J,this.z=M}set($,J,M){if(M===void 0)M=this.z;return this.x=$,this.y=J,this.z=M,this}setScalar($){return this.x=$,this.y=$,this.z=$,this}setX($){return this.x=$,this}setY($){return this.y=$,this}setZ($){return this.z=$,this}setComponent($,J){switch($){case 0:this.x=J;break;case 1:this.y=J;break;case 2:this.z=J;break;default:throw Error("index is out of range: "+$)}return this}getComponent($){switch($){case 0:return this.x;case 1:return this.y;case 2:return this.z;default:throw Error("index is out of range: "+$)}}clone(){return new this.constructor(this.x,this.y,this.z)}copy($){return this.x=$.x,this.y=$.y,this.z=$.z,this}add($){return this.x+=$.x,this.y+=$.y,this.z+=$.z,this}addScalar($){return this.x+=$,this.y+=$,this.z+=$,this}addVectors($,J){return this.x=$.x+J.x,this.y=$.y+J.y,this.z=$.z+J.z,this}addScaledVector($,J){return this.x+=$.x*J,this.y+=$.y*J,this.z+=$.z*J,this}sub($){return this.x-=$.x,this.y-=$.y,this.z-=$.z,this}subScalar($){return this.x-=$,this.y-=$,this.z-=$,this}subVectors($,J){return this.x=$.x-J.x,this.y=$.y-J.y,this.z=$.z-J.z,this}multiply($){return this.x*=$.x,this.y*=$.y,this.z*=$.z,this}multiplyScalar($){return this.x*=$,this.y*=$,this.z*=$,this}multiplyVectors($,J){return this.x=$.x*J.x,this.y=$.y*J.y,this.z=$.z*J.z,this}applyEuler($){return this.applyQuaternion(FJ.setFromEuler($))}applyAxisAngle($,J){return this.applyQuaternion(FJ.setFromAxisAngle($,J))}applyMatrix3($){let J=this.x,M=this.y,Q=this.z,H=$.elements;return this.x=H[0]*J+H[3]*M+H[6]*Q,this.y=H[1]*J+H[4]*M+H[7]*Q,this.z=H[2]*J+H[5]*M+H[8]*Q,this}applyNormalMatrix($){return this.applyMatrix3($).normalize()}applyMatrix4($){let J=this.x,M=this.y,Q=this.z,H=$.elements,k=1/(H[3]*J+H[7]*M+H[11]*Q+H[15]);return this.x=(H[0]*J+H[4]*M+H[8]*Q+H[12])*k,this.y=(H[1]*J+H[5]*M+H[9]*Q+H[13])*k,this.z=(H[2]*J+H[6]*M+H[10]*Q+H[14])*k,this}applyQuaternion($){let J=this.x,M=this.y,Q=this.z,H=$.x,k=$.y,K=$.z,w=$.w,W=2*(k*Q-K*M),E=2*(K*J-H*Q),R=2*(H*M-k*J);return this.x=J+w*W+k*R-K*E,this.y=M+w*E+K*W-H*R,this.z=Q+w*R+H*E-k*W,this}project($){return this.applyMatrix4($.matrixWorldInverse).applyMatrix4($.projectionMatrix)}unproject($){return this.applyMatrix4($.projectionMatrixInverse).applyMatrix4($.matrixWorld)}transformDirection($){let J=this.x,M=this.y,Q=this.z,H=$.elements;return this.x=H[0]*J+H[4]*M+H[8]*Q,this.y=H[1]*J+H[5]*M+H[9]*Q,this.z=H[2]*J+H[6]*M+H[10]*Q,this.normalize()}divide($){return this.x/=$.x,this.y/=$.y,this.z/=$.z,this}divideScalar($){return this.multiplyScalar(1/$)}min($){return this.x=Math.min(this.x,$.x),this.y=Math.min(this.y,$.y),this.z=Math.min(this.z,$.z),this}max($){return this.x=Math.max(this.x,$.x),this.y=Math.max(this.y,$.y),this.z=Math.max(this.z,$.z),this}clamp($,J){return this.x=c0(this.x,$.x,J.x),this.y=c0(this.y,$.y,J.y),this.z=c0(this.z,$.z,J.z),this}clampScalar($,J){return this.x=c0(this.x,$,J),this.y=c0(this.y,$,J),this.z=c0(this.z,$,J),this}clampLength($,J){let M=this.length();return this.divideScalar(M||1).multiplyScalar(c0(M,$,J))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this}dot($){return this.x*$.x+this.y*$.y+this.z*$.z}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)}normalize(){return this.divideScalar(this.length()||1)}setLength($){return this.normalize().multiplyScalar($)}lerp($,J){return this.x+=($.x-this.x)*J,this.y+=($.y-this.y)*J,this.z+=($.z-this.z)*J,this}lerpVectors($,J,M){return this.x=$.x+(J.x-$.x)*M,this.y=$.y+(J.y-$.y)*M,this.z=$.z+(J.z-$.z)*M,this}cross($){return this.crossVectors(this,$)}crossVectors($,J){let{x:M,y:Q,z:H}=$,k=J.x,K=J.y,w=J.z;return this.x=Q*w-H*K,this.y=H*k-M*w,this.z=M*K-Q*k,this}projectOnVector($){let J=$.lengthSq();if(J===0)return this.set(0,0,0);let M=$.dot(this)/J;return this.copy($).multiplyScalar(M)}projectOnPlane($){return M9.copy(this).projectOnVector($),this.sub(M9)}reflect($){return this.sub(M9.copy($).multiplyScalar(2*this.dot($)))}angleTo($){let J=Math.sqrt(this.lengthSq()*$.lengthSq());if(J===0)return Math.PI/2;let M=this.dot($)/J;return Math.acos(c0(M,-1,1))}distanceTo($){return Math.sqrt(this.distanceToSquared($))}distanceToSquared($){let J=this.x-$.x,M=this.y-$.y,Q=this.z-$.z;return J*J+M*M+Q*Q}manhattanDistanceTo($){return Math.abs(this.x-$.x)+Math.abs(this.y-$.y)+Math.abs(this.z-$.z)}setFromSpherical($){return this.setFromSphericalCoords($.radius,$.phi,$.theta)}setFromSphericalCoords($,J,M){let Q=Math.sin(J)*$;return this.x=Q*Math.sin(M),this.y=Math.cos(J)*$,this.z=Q*Math.cos(M),this}setFromCylindrical($){return this.setFromCylindricalCoords($.radius,$.theta,$.y)}setFromCylindricalCoords($,J,M){return this.x=$*Math.sin(J),this.y=M,this.z=$*Math.cos(J),this}setFromMatrixPosition($){let J=$.elements;return this.x=J[12],this.y=J[13],this.z=J[14],this}setFromMatrixScale($){let J=this.setFromMatrixColumn($,0).length(),M=this.setFromMatrixColumn($,1).length(),Q=this.setFromMatrixColumn($,2).length();return this.x=J,this.y=M,this.z=Q,this}setFromMatrixColumn($,J){return this.fromArray($.elements,J*4)}setFromMatrix3Column($,J){return this.fromArray($.elements,J*3)}setFromEuler($){return this.x=$._x,this.y=$._y,this.z=$._z,this}setFromColor($){return this.x=$.r,this.y=$.g,this.z=$.b,this}equals($){return $.x===this.x&&$.y===this.y&&$.z===this.z}fromArray($,J=0){return this.x=$[J],this.y=$[J+1],this.z=$[J+2],this}toArray($=[],J=0){return $[J]=this.x,$[J+1]=this.y,$[J+2]=this.z,$}fromBufferAttribute($,J){return this.x=$.getX(J),this.y=$.getY(J),this.z=$.getZ(J),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this}randomDirection(){let $=Math.random()*Math.PI*2,J=Math.random()*2-1,M=Math.sqrt(1-J*J);return this.x=M*Math.cos($),this.y=J,this.z=M*Math.sin($),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z}}var M9=new A,FJ=new m0;class p0{constructor($,J,M,Q,H,k,K,w,W){if(p0.prototype.isMatrix3=!0,this.elements=[1,0,0,0,1,0,0,0,1],$!==void 0)this.set($,J,M,Q,H,k,K,w,W)}set($,J,M,Q,H,k,K,w,W){let E=this.elements;return E[0]=$,E[1]=Q,E[2]=K,E[3]=J,E[4]=H,E[5]=w,E[6]=M,E[7]=k,E[8]=W,this}identity(){return this.set(1,0,0,0,1,0,0,0,1),this}copy($){let J=this.elements,M=$.elements;return J[0]=M[0],J[1]=M[1],J[2]=M[2],J[3]=M[3],J[4]=M[4],J[5]=M[5],J[6]=M[6],J[7]=M[7],J[8]=M[8],this}extractBasis($,J,M){return $.setFromMatrix3Column(this,0),J.setFromMatrix3Column(this,1),M.setFromMatrix3Column(this,2),this}setFromMatrix4($){let J=$.elements;return this.set(J[0],J[4],J[8],J[1],J[5],J[9],J[2],J[6],J[10]),this}multiply($){return this.multiplyMatrices(this,$)}premultiply($){return this.multiplyMatrices($,this)}multiplyMatrices($,J){let M=$.elements,Q=J.elements,H=this.elements,k=M[0],K=M[3],w=M[6],W=M[1],E=M[4],R=M[7],Z=M[2],U=M[5],X=M[8],G=Q[0],q=Q[3],Y=Q[6],N=Q[1],V=Q[4],D=Q[7],P=Q[2],h=Q[5],B=Q[8];return H[0]=k*G+K*N+w*P,H[3]=k*q+K*V+w*h,H[6]=k*Y+K*D+w*B,H[1]=W*G+E*N+R*P,H[4]=W*q+E*V+R*h,H[7]=W*Y+E*D+R*B,H[2]=Z*G+U*N+X*P,H[5]=Z*q+U*V+X*h,H[8]=Z*Y+U*D+X*B,this}multiplyScalar($){let J=this.elements;return J[0]*=$,J[3]*=$,J[6]*=$,J[1]*=$,J[4]*=$,J[7]*=$,J[2]*=$,J[5]*=$,J[8]*=$,this}determinant(){let $=this.elements,J=$[0],M=$[1],Q=$[2],H=$[3],k=$[4],K=$[5],w=$[6],W=$[7],E=$[8];return J*k*E-J*K*W-M*H*E+M*K*w+Q*H*W-Q*k*w}invert(){let $=this.elements,J=$[0],M=$[1],Q=$[2],H=$[3],k=$[4],K=$[5],w=$[6],W=$[7],E=$[8],R=E*k-K*W,Z=K*w-E*H,U=W*H-k*w,X=J*R+M*Z+Q*U;if(X===0)return this.set(0,0,0,0,0,0,0,0,0);let G=1/X;return $[0]=R*G,$[1]=(Q*W-E*M)*G,$[2]=(K*M-Q*k)*G,$[3]=Z*G,$[4]=(E*J-Q*w)*G,$[5]=(Q*H-K*J)*G,$[6]=U*G,$[7]=(M*w-W*J)*G,$[8]=(k*J-M*H)*G,this}transpose(){let $,J=this.elements;return $=J[1],J[1]=J[3],J[3]=$,$=J[2],J[2]=J[6],J[6]=$,$=J[5],J[5]=J[7],J[7]=$,this}getNormalMatrix($){return this.setFromMatrix4($).invert().transpose()}transposeIntoArray($){let J=this.elements;return $[0]=J[0],$[1]=J[3],$[2]=J[6],$[3]=J[1],$[4]=J[4],$[5]=J[7],$[6]=J[2],$[7]=J[5],$[8]=J[8],this}setUvTransform($,J,M,Q,H,k,K){let w=Math.cos(H),W=Math.sin(H);return this.set(M*w,M*W,-M*(w*k+W*K)+k+$,-Q*W,Q*w,-Q*(-W*k+w*K)+K+J,0,0,1),this}scale($,J){return this.premultiply(Q9.makeScale($,J)),this}rotate($){return this.premultiply(Q9.makeRotation(-$)),this}translate($,J){return this.premultiply(Q9.makeTranslation($,J)),this}makeTranslation($,J){if($.isVector2)this.set(1,0,$.x,0,1,$.y,0,0,1);else this.set(1,0,$,0,1,J,0,0,1);return this}makeRotation($){let J=Math.cos($),M=Math.sin($);return this.set(J,-M,0,M,J,0,0,0,1),this}makeScale($,J){return this.set($,0,0,0,J,0,0,0,1),this}equals($){let J=this.elements,M=$.elements;for(let Q=0;Q<9;Q++)if(J[Q]!==M[Q])return!1;return!0}fromArray($,J=0){for(let M=0;M<9;M++)this.elements[M]=$[M+J];return this}toArray($=[],J=0){let M=this.elements;return $[J]=M[0],$[J+1]=M[1],$[J+2]=M[2],$[J+3]=M[3],$[J+4]=M[4],$[J+5]=M[5],$[J+6]=M[6],$[J+7]=M[7],$[J+8]=M[8],$}clone(){return new this.constructor().fromArray(this.elements)}}var Q9=new p0;function R7($){for(let J=$.length-1;J>=0;--J)if($[J]>=65535)return!0;return!1}function k6($){return document.createElementNS("http://www.w3.org/1999/xhtml",$)}function uM(){let $=k6("canvas");return $.style.display="block",$}var LJ={};function r5($){if($ in LJ)return;LJ[$]=!0,console.warn($)}function cM($,J,M){return new Promise(function(Q,H){function k(){switch($.clientWaitSync(J,$.SYNC_FLUSH_COMMANDS_BIT,0)){case $.WAIT_FAILED:H();break;case $.TIMEOUT_EXPIRED:setTimeout(k,M);break;default:Q()}}setTimeout(k,M)})}var PJ=new p0().set(0.4123908,0.3575843,0.1804808,0.212639,0.7151687,0.0721923,0.0193308,0.1191948,0.9505322),zJ=new p0().set(3.2409699,-1.5373832,-0.4986108,-0.9692436,1.8759675,0.0415551,0.0556301,-0.203977,1.0569715);function VH(){let $={enabled:!0,workingColorSpace:"srgb-linear",spaces:{},convert:function(H,k,K){if(this.enabled===!1||k===K||!k||!K)return H;if(this.spaces[k].transfer==="srgb")H.r=B5(H.r),H.g=B5(H.g),H.b=B5(H.b);if(this.spaces[k].primaries!==this.spaces[K].primaries)H.applyMatrix3(this.spaces[k].toXYZ),H.applyMatrix3(this.spaces[K].fromXYZ);if(this.spaces[K].transfer==="srgb")H.r=C8(H.r),H.g=C8(H.g),H.b=C8(H.b);return H},workingToColorSpace:function(H,k){return this.convert(H,this.workingColorSpace,k)},colorSpaceToWorking:function(H,k){return this.convert(H,k,this.workingColorSpace)},getPrimaries:function(H){return this.spaces[H].primaries},getTransfer:function(H){if(H==="")return"linear";return this.spaces[H].transfer},getLuminanceCoefficients:function(H,k=this.workingColorSpace){return H.fromArray(this.spaces[k].luminanceCoefficients)},define:function(H){Object.assign(this.spaces,H)},_getMatrix:function(H,k,K){return H.copy(this.spaces[k].toXYZ).multiply(this.spaces[K].fromXYZ)},_getDrawingBufferColorSpace:function(H){return this.spaces[H].outputColorSpaceConfig.drawingBufferColorSpace},_getUnpackColorSpace:function(H=this.workingColorSpace){return this.spaces[H].workingColorSpaceConfig.unpackColorSpace},fromWorkingColorSpace:function(H,k){return r5("THREE.ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."),$.workingToColorSpace(H,k)},toWorkingColorSpace:function(H,k){return r5("THREE.ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."),$.colorSpaceToWorking(H,k)}},J=[0.64,0.33,0.3,0.6,0.15,0.06],M=[0.2126,0.7152,0.0722],Q=[0.3127,0.329];return $.define({["srgb-linear"]:{primaries:J,whitePoint:Q,transfer:"linear",toXYZ:PJ,fromXYZ:zJ,luminanceCoefficients:M,workingColorSpaceConfig:{unpackColorSpace:"srgb"},outputColorSpaceConfig:{drawingBufferColorSpace:"srgb"}},["srgb"]:{primaries:J,whitePoint:Q,transfer:"srgb",toXYZ:PJ,fromXYZ:zJ,luminanceCoefficients:M,outputColorSpaceConfig:{drawingBufferColorSpace:"srgb"}}}),$}var r0=VH();function B5($){return $<0.04045?$*0.0773993808:Math.pow($*0.9478672986+0.0521327014,2.4)}function C8($){return $<0.0031308?$*12.92:1.055*Math.pow($,0.41666)-0.055}var N8;class U7{static getDataURL($,J="image/png"){if(/^data:/i.test($.src))return $.src;if(typeof HTMLCanvasElement>"u")return $.src;let M;if($ instanceof HTMLCanvasElement)M=$;else{if(N8===void 0)N8=k6("canvas");N8.width=$.width,N8.height=$.height;let Q=N8.getContext("2d");if($ instanceof ImageData)Q.putImageData($,0,0);else Q.drawImage($,0,0,$.width,$.height);M=N8}return M.toDataURL(J)}static sRGBToLinear($){if(typeof HTMLImageElement<"u"&&$ instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&$ instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&$ instanceof ImageBitmap){let J=k6("canvas");J.width=$.width,J.height=$.height;let M=J.getContext("2d");M.drawImage($,0,0,$.width,$.height);let Q=M.getImageData(0,0,$.width,$.height),H=Q.data;for(let k=0;k<H.length;k++)H[k]=B5(H[k]/255)*255;return M.putImageData(Q,0,0),J}else if($.data){let J=$.data.slice(0);for(let M=0;M<J.length;M++)if(J instanceof Uint8Array||J instanceof Uint8ClampedArray)J[M]=Math.floor(B5(J[M]/255)*255);else J[M]=B5(J[M]);return{data:J,width:$.width,height:$.height}}else return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."),$}}var BH=0;class X6{constructor($=null){this.isSource=!0,Object.defineProperty(this,"id",{value:BH++}),this.uuid=N6(),this.data=$,this.dataReady=!0,this.version=0}getSize($){let J=this.data;if(J instanceof HTMLVideoElement)$.set(J.videoWidth,J.videoHeight,0);else if(J instanceof VideoFrame)$.set(J.displayHeight,J.displayWidth,0);else if(J!==null)$.set(J.width,J.height,J.depth||0);else $.set(0,0,0);return $}set needsUpdate($){if($===!0)this.version++}toJSON($){let J=$===void 0||typeof $==="string";if(!J&&$.images[this.uuid]!==void 0)return $.images[this.uuid];let M={uuid:this.uuid,url:""},Q=this.data;if(Q!==null){let H;if(Array.isArray(Q)){H=[];for(let k=0,K=Q.length;k<K;k++)if(Q[k].isDataTexture)H.push(H9(Q[k].image));else H.push(H9(Q[k]))}else H=H9(Q);M.url=H}if(!J)$.images[this.uuid]=M;return M}}function H9($){if(typeof HTMLImageElement<"u"&&$ instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&$ instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&$ instanceof ImageBitmap)return U7.getDataURL($);else if($.data)return{data:Array.from($.data),width:$.width,height:$.height,type:$.data.constructor.name};else return console.warn("THREE.Texture: Unable to serialize Texture."),{}}var IH=0,k9=new A;class T1 extends p5{constructor($=T1.DEFAULT_IMAGE,J=T1.DEFAULT_MAPPING,M=1001,Q=1001,H=1006,k=1008,K=1023,w=1009,W=T1.DEFAULT_ANISOTROPY,E=""){super();this.isTexture=!0,Object.defineProperty(this,"id",{value:IH++}),this.uuid=N6(),this.name="",this.source=new X6($),this.mipmaps=[],this.mapping=J,this.channel=0,this.wrapS=M,this.wrapT=Q,this.magFilter=H,this.minFilter=k,this.anisotropy=W,this.format=K,this.internalFormat=null,this.type=w,this.offset=new J1(0,0),this.repeat=new J1(1,1),this.center=new J1(0,0),this.rotation=0,this.matrixAutoUpdate=!0,this.matrix=new p0,this.generateMipmaps=!0,this.premultiplyAlpha=!1,this.flipY=!0,this.unpackAlignment=4,this.colorSpace=E,this.userData={},this.updateRanges=[],this.version=0,this.onUpdate=null,this.renderTarget=null,this.isRenderTargetTexture=!1,this.isArrayTexture=$&&$.depth&&$.depth>1?!0:!1,this.pmremVersion=0}get width(){return this.source.getSize(k9).x}get height(){return this.source.getSize(k9).y}get depth(){return this.source.getSize(k9).z}get image(){return this.source.data}set image($=null){this.source.data=$}updateMatrix(){this.matrix.setUvTransform(this.offset.x,this.offset.y,this.repeat.x,this.repeat.y,this.rotation,this.center.x,this.center.y)}addUpdateRange($,J){this.updateRanges.push({start:$,count:J})}clearUpdateRanges(){this.updateRanges.length=0}clone(){return new this.constructor().copy(this)}copy($){return this.name=$.name,this.source=$.source,this.mipmaps=$.mipmaps.slice(0),this.mapping=$.mapping,this.channel=$.channel,this.wrapS=$.wrapS,this.wrapT=$.wrapT,this.magFilter=$.magFilter,this.minFilter=$.minFilter,this.anisotropy=$.anisotropy,this.format=$.format,this.internalFormat=$.internalFormat,this.type=$.type,this.offset.copy($.offset),this.repeat.copy($.repeat),this.center.copy($.center),this.rotation=$.rotation,this.matrixAutoUpdate=$.matrixAutoUpdate,this.matrix.copy($.matrix),this.generateMipmaps=$.generateMipmaps,this.premultiplyAlpha=$.premultiplyAlpha,this.flipY=$.flipY,this.unpackAlignment=$.unpackAlignment,this.colorSpace=$.colorSpace,this.renderTarget=$.renderTarget,this.isRenderTargetTexture=$.isRenderTargetTexture,this.isArrayTexture=$.isArrayTexture,this.userData=JSON.parse(JSON.stringify($.userData)),this.needsUpdate=!0,this}setValues($){for(let J in $){let M=$[J];if(M===void 0){console.warn(`THREE.Texture.setValues(): parameter '${J}' has value of undefined.`);continue}let Q=this[J];if(Q===void 0){console.warn(`THREE.Texture.setValues(): property '${J}' does not exist.`);continue}if(Q&&M&&(Q.isVector2&&M.isVector2))Q.copy(M);else if(Q&&M&&(Q.isVector3&&M.isVector3))Q.copy(M);else if(Q&&M&&(Q.isMatrix3&&M.isMatrix3))Q.copy(M);else this[J]=M}}toJSON($){let J=$===void 0||typeof $==="string";if(!J&&$.textures[this.uuid]!==void 0)return $.textures[this.uuid];let M={metadata:{version:4.7,type:"Texture",generator:"Texture.toJSON"},uuid:this.uuid,name:this.name,image:this.source.toJSON($).uuid,mapping:this.mapping,channel:this.channel,repeat:[this.repeat.x,this.repeat.y],offset:[this.offset.x,this.offset.y],center:[this.center.x,this.center.y],rotation:this.rotation,wrap:[this.wrapS,this.wrapT],format:this.format,internalFormat:this.internalFormat,type:this.type,colorSpace:this.colorSpace,minFilter:this.minFilter,magFilter:this.magFilter,anisotropy:this.anisotropy,flipY:this.flipY,generateMipmaps:this.generateMipmaps,premultiplyAlpha:this.premultiplyAlpha,unpackAlignment:this.unpackAlignment};if(Object.keys(this.userData).length>0)M.userData=this.userData;if(!J)$.textures[this.uuid]=M;return M}dispose(){this.dispatchEvent({type:"dispose"})}transformUv($){if(this.mapping!==300)return $;if($.applyMatrix3(this.matrix),$.x<0||$.x>1)switch(this.wrapS){case 1000:$.x=$.x-Math.floor($.x);break;case 1001:$.x=$.x<0?0:1;break;case 1002:if(Math.abs(Math.floor($.x)%2)===1)$.x=Math.ceil($.x)-$.x;else $.x=$.x-Math.floor($.x);break}if($.y<0||$.y>1)switch(this.wrapT){case 1000:$.y=$.y-Math.floor($.y);break;case 1001:$.y=$.y<0?0:1;break;case 1002:if(Math.abs(Math.floor($.y)%2)===1)$.y=Math.ceil($.y)-$.y;else $.y=$.y-Math.floor($.y);break}if(this.flipY)$.y=1-$.y;return $}set needsUpdate($){if($===!0)this.version++,this.source.needsUpdate=!0}set needsPMREMUpdate($){if($===!0)this.pmremVersion++}}T1.DEFAULT_IMAGE=null;T1.DEFAULT_MAPPING=300;T1.DEFAULT_ANISOTROPY=1;class U1{constructor($=0,J=0,M=0,Q=1){U1.prototype.isVector4=!0,this.x=$,this.y=J,this.z=M,this.w=Q}get width(){return this.z}set width($){this.z=$}get height(){return this.w}set height($){this.w=$}set($,J,M,Q){return this.x=$,this.y=J,this.z=M,this.w=Q,this}setScalar($){return this.x=$,this.y=$,this.z=$,this.w=$,this}setX($){return this.x=$,this}setY($){return this.y=$,this}setZ($){return this.z=$,this}setW($){return this.w=$,this}setComponent($,J){switch($){case 0:this.x=J;break;case 1:this.y=J;break;case 2:this.z=J;break;case 3:this.w=J;break;default:throw Error("index is out of range: "+$)}return this}getComponent($){switch($){case 0:return this.x;case 1:return this.y;case 2:return this.z;case 3:return this.w;default:throw Error("index is out of range: "+$)}}clone(){return new this.constructor(this.x,this.y,this.z,this.w)}copy($){return this.x=$.x,this.y=$.y,this.z=$.z,this.w=$.w!==void 0?$.w:1,this}add($){return this.x+=$.x,this.y+=$.y,this.z+=$.z,this.w+=$.w,this}addScalar($){return this.x+=$,this.y+=$,this.z+=$,this.w+=$,this}addVectors($,J){return this.x=$.x+J.x,this.y=$.y+J.y,this.z=$.z+J.z,this.w=$.w+J.w,this}addScaledVector($,J){return this.x+=$.x*J,this.y+=$.y*J,this.z+=$.z*J,this.w+=$.w*J,this}sub($){return this.x-=$.x,this.y-=$.y,this.z-=$.z,this.w-=$.w,this}subScalar($){return this.x-=$,this.y-=$,this.z-=$,this.w-=$,this}subVectors($,J){return this.x=$.x-J.x,this.y=$.y-J.y,this.z=$.z-J.z,this.w=$.w-J.w,this}multiply($){return this.x*=$.x,this.y*=$.y,this.z*=$.z,this.w*=$.w,this}multiplyScalar($){return this.x*=$,this.y*=$,this.z*=$,this.w*=$,this}applyMatrix4($){let J=this.x,M=this.y,Q=this.z,H=this.w,k=$.elements;return this.x=k[0]*J+k[4]*M+k[8]*Q+k[12]*H,this.y=k[1]*J+k[5]*M+k[9]*Q+k[13]*H,this.z=k[2]*J+k[6]*M+k[10]*Q+k[14]*H,this.w=k[3]*J+k[7]*M+k[11]*Q+k[15]*H,this}divide($){return this.x/=$.x,this.y/=$.y,this.z/=$.z,this.w/=$.w,this}divideScalar($){return this.multiplyScalar(1/$)}setAxisAngleFromQuaternion($){this.w=2*Math.acos($.w);let J=Math.sqrt(1-$.w*$.w);if(J<0.0001)this.x=1,this.y=0,this.z=0;else this.x=$.x/J,this.y=$.y/J,this.z=$.z/J;return this}setAxisAngleFromRotationMatrix($){let J,M,Q,H,k=0.01,K=0.1,w=$.elements,W=w[0],E=w[4],R=w[8],Z=w[1],U=w[5],X=w[9],G=w[2],q=w[6],Y=w[10];if(Math.abs(E-Z)<0.01&&Math.abs(R-G)<0.01&&Math.abs(X-q)<0.01){if(Math.abs(E+Z)<0.1&&Math.abs(R+G)<0.1&&Math.abs(X+q)<0.1&&Math.abs(W+U+Y-3)<0.1)return this.set(1,0,0,0),this;J=Math.PI;let V=(W+1)/2,D=(U+1)/2,P=(Y+1)/2,h=(E+Z)/4,B=(R+G)/4,S=(X+q)/4;if(V>D&&V>P)if(V<0.01)M=0,Q=0.707106781,H=0.707106781;else M=Math.sqrt(V),Q=h/M,H=B/M;else if(D>P)if(D<0.01)M=0.707106781,Q=0,H=0.707106781;else Q=Math.sqrt(D),M=h/Q,H=S/Q;else if(P<0.01)M=0.707106781,Q=0.707106781,H=0;else H=Math.sqrt(P),M=B/H,Q=S/H;return this.set(M,Q,H,J),this}let N=Math.sqrt((q-X)*(q-X)+(R-G)*(R-G)+(Z-E)*(Z-E));if(Math.abs(N)<0.001)N=1;return this.x=(q-X)/N,this.y=(R-G)/N,this.z=(Z-E)/N,this.w=Math.acos((W+U+Y-1)/2),this}setFromMatrixPosition($){let J=$.elements;return this.x=J[12],this.y=J[13],this.z=J[14],this.w=J[15],this}min($){return this.x=Math.min(this.x,$.x),this.y=Math.min(this.y,$.y),this.z=Math.min(this.z,$.z),this.w=Math.min(this.w,$.w),this}max($){return this.x=Math.max(this.x,$.x),this.y=Math.max(this.y,$.y),this.z=Math.max(this.z,$.z),this.w=Math.max(this.w,$.w),this}clamp($,J){return this.x=c0(this.x,$.x,J.x),this.y=c0(this.y,$.y,J.y),this.z=c0(this.z,$.z,J.z),this.w=c0(this.w,$.w,J.w),this}clampScalar($,J){return this.x=c0(this.x,$,J),this.y=c0(this.y,$,J),this.z=c0(this.z,$,J),this.w=c0(this.w,$,J),this}clampLength($,J){let M=this.length();return this.divideScalar(M||1).multiplyScalar(c0(M,$,J))}floor(){return this.x=Math.floor(this.x),this.y=Math.floor(this.y),this.z=Math.floor(this.z),this.w=Math.floor(this.w),this}ceil(){return this.x=Math.ceil(this.x),this.y=Math.ceil(this.y),this.z=Math.ceil(this.z),this.w=Math.ceil(this.w),this}round(){return this.x=Math.round(this.x),this.y=Math.round(this.y),this.z=Math.round(this.z),this.w=Math.round(this.w),this}roundToZero(){return this.x=Math.trunc(this.x),this.y=Math.trunc(this.y),this.z=Math.trunc(this.z),this.w=Math.trunc(this.w),this}negate(){return this.x=-this.x,this.y=-this.y,this.z=-this.z,this.w=-this.w,this}dot($){return this.x*$.x+this.y*$.y+this.z*$.z+this.w*$.w}lengthSq(){return this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w}length(){return Math.sqrt(this.x*this.x+this.y*this.y+this.z*this.z+this.w*this.w)}manhattanLength(){return Math.abs(this.x)+Math.abs(this.y)+Math.abs(this.z)+Math.abs(this.w)}normalize(){return this.divideScalar(this.length()||1)}setLength($){return this.normalize().multiplyScalar($)}lerp($,J){return this.x+=($.x-this.x)*J,this.y+=($.y-this.y)*J,this.z+=($.z-this.z)*J,this.w+=($.w-this.w)*J,this}lerpVectors($,J,M){return this.x=$.x+(J.x-$.x)*M,this.y=$.y+(J.y-$.y)*M,this.z=$.z+(J.z-$.z)*M,this.w=$.w+(J.w-$.w)*M,this}equals($){return $.x===this.x&&$.y===this.y&&$.z===this.z&&$.w===this.w}fromArray($,J=0){return this.x=$[J],this.y=$[J+1],this.z=$[J+2],this.w=$[J+3],this}toArray($=[],J=0){return $[J]=this.x,$[J+1]=this.y,$[J+2]=this.z,$[J+3]=this.w,$}fromBufferAttribute($,J){return this.x=$.getX(J),this.y=$.getY(J),this.z=$.getZ(J),this.w=$.getW(J),this}random(){return this.x=Math.random(),this.y=Math.random(),this.z=Math.random(),this.w=Math.random(),this}*[Symbol.iterator](){yield this.x,yield this.y,yield this.z,yield this.w}}class Y7 extends p5{constructor($=1,J=1,M={}){super();M=Object.assign({generateMipmaps:!1,internalFormat:null,minFilter:1006,depthBuffer:!0,stencilBuffer:!1,resolveDepthBuffer:!0,resolveStencilBuffer:!0,depthTexture:null,samples:0,count:1,depth:1,multiview:!1},M),this.isRenderTarget=!0,this.width=$,this.height=J,this.depth=M.depth,this.scissor=new U1(0,0,$,J),this.scissorTest=!1,this.viewport=new U1(0,0,$,J);let Q={width:$,height:J,depth:M.depth},H=new T1(Q);this.textures=[];let k=M.count;for(let K=0;K<k;K++)this.textures[K]=H.clone(),this.textures[K].isRenderTargetTexture=!0,this.textures[K].renderTarget=this;this._setTextureOptions(M),this.depthBuffer=M.depthBuffer,this.stencilBuffer=M.stencilBuffer,this.resolveDepthBuffer=M.resolveDepthBuffer,this.resolveStencilBuffer=M.resolveStencilBuffer,this._depthTexture=null,this.depthTexture=M.depthTexture,this.samples=M.samples,this.multiview=M.multiview}_setTextureOptions($={}){let J={minFilter:1006,generateMipmaps:!1,flipY:!1,internalFormat:null};if($.mapping!==void 0)J.mapping=$.mapping;if($.wrapS!==void 0)J.wrapS=$.wrapS;if($.wrapT!==void 0)J.wrapT=$.wrapT;if($.wrapR!==void 0)J.wrapR=$.wrapR;if($.magFilter!==void 0)J.magFilter=$.magFilter;if($.minFilter!==void 0)J.minFilter=$.minFilter;if($.format!==void 0)J.format=$.format;if($.type!==void 0)J.type=$.type;if($.anisotropy!==void 0)J.anisotropy=$.anisotropy;if($.colorSpace!==void 0)J.colorSpace=$.colorSpace;if($.flipY!==void 0)J.flipY=$.flipY;if($.generateMipmaps!==void 0)J.generateMipmaps=$.generateMipmaps;if($.internalFormat!==void 0)J.internalFormat=$.internalFormat;for(let M=0;M<this.textures.length;M++)this.textures[M].setValues(J)}get texture(){return this.textures[0]}set texture($){this.textures[0]=$}set depthTexture($){if(this._depthTexture!==null)this._depthTexture.renderTarget=null;if($!==null)$.renderTarget=this;this._depthTexture=$}get depthTexture(){return this._depthTexture}setSize($,J,M=1){if(this.width!==$||this.height!==J||this.depth!==M){this.width=$,this.height=J,this.depth=M;for(let Q=0,H=this.textures.length;Q<H;Q++)this.textures[Q].image.width=$,this.textures[Q].image.height=J,this.textures[Q].image.depth=M,this.textures[Q].isArrayTexture=this.textures[Q].image.depth>1;this.dispose()}this.viewport.set(0,0,$,J),this.scissor.set(0,0,$,J)}clone(){return new this.constructor().copy(this)}copy($){this.width=$.width,this.height=$.height,this.depth=$.depth,this.scissor.copy($.scissor),this.scissorTest=$.scissorTest,this.viewport.copy($.viewport),this.textures.length=0;for(let J=0,M=$.textures.length;J<M;J++){this.textures[J]=$.textures[J].clone(),this.textures[J].isRenderTargetTexture=!0,this.textures[J].renderTarget=this;let Q=Object.assign({},$.textures[J].image);this.textures[J].source=new X6(Q)}if(this.depthBuffer=$.depthBuffer,this.stencilBuffer=$.stencilBuffer,this.resolveDepthBuffer=$.resolveDepthBuffer,this.resolveStencilBuffer=$.resolveStencilBuffer,$.depthTexture!==null)this.depthTexture=$.depthTexture.clone();return this.samples=$.samples,this}dispose(){this.dispatchEvent({type:"dispose"})}}class M5 extends Y7{constructor($=1,J=1,M={}){super($,J,M);this.isWebGLRenderTarget=!0}}class O$ extends T1{constructor($=null,J=1,M=1,Q=1){super(null);this.isDataArrayTexture=!0,this.image={data:$,width:J,height:M,depth:Q},this.magFilter=1003,this.minFilter=1003,this.wrapR=1001,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1,this.layerUpdates=new Set}addLayerUpdate($){this.layerUpdates.add($)}clearLayerUpdates(){this.layerUpdates.clear()}}class N7 extends T1{constructor($=null,J=1,M=1,Q=1){super(null);this.isData3DTexture=!0,this.image={data:$,width:J,height:M,depth:Q},this.magFilter=1003,this.minFilter=1003,this.wrapR=1001,this.generateMipmaps=!1,this.flipY=!1,this.unpackAlignment=1}}class $8{constructor($=new A(1/0,1/0,1/0),J=new A(-1/0,-1/0,-1/0)){this.isBox3=!0,this.min=$,this.max=J}set($,J){return this.min.copy($),this.max.copy(J),this}setFromArray($){this.makeEmpty();for(let J=0,M=$.length;J<M;J+=3)this.expandByPoint(K5.fromArray($,J));return this}setFromBufferAttribute($){this.makeEmpty();for(let J=0,M=$.count;J<M;J++)this.expandByPoint(K5.fromBufferAttribute($,J));return this}setFromPoints($){this.makeEmpty();for(let J=0,M=$.length;J<M;J++)this.expandByPoint($[J]);return this}setFromCenterAndSize($,J){let M=K5.copy(J).multiplyScalar(0.5);return this.min.copy($).sub(M),this.max.copy($).add(M),this}setFromObject($,J=!1){return this.makeEmpty(),this.expandByObject($,J)}clone(){return new this.constructor().copy(this)}copy($){return this.min.copy($.min),this.max.copy($.max),this}makeEmpty(){return this.min.x=this.min.y=this.min.z=1/0,this.max.x=this.max.y=this.max.z=-1/0,this}isEmpty(){return this.max.x<this.min.x||this.max.y<this.min.y||this.max.z<this.min.z}getCenter($){return this.isEmpty()?$.set(0,0,0):$.addVectors(this.min,this.max).multiplyScalar(0.5)}getSize($){return this.isEmpty()?$.set(0,0,0):$.subVectors(this.max,this.min)}expandByPoint($){return this.min.min($),this.max.max($),this}expandByVector($){return this.min.sub($),this.max.add($),this}expandByScalar($){return this.min.addScalar(-$),this.max.addScalar($),this}expandByObject($,J=!1){$.updateWorldMatrix(!1,!1);let M=$.geometry;if(M!==void 0){let H=M.getAttribute("position");if(J===!0&&H!==void 0&&$.isInstancedMesh!==!0)for(let k=0,K=H.count;k<K;k++){if($.isMesh===!0)$.getVertexPosition(k,K5);else K5.fromBufferAttribute(H,k);K5.applyMatrix4($.matrixWorld),this.expandByPoint(K5)}else{if($.boundingBox!==void 0){if($.boundingBox===null)$.computeBoundingBox();j6.copy($.boundingBox)}else{if(M.boundingBox===null)M.computeBoundingBox();j6.copy(M.boundingBox)}j6.applyMatrix4($.matrixWorld),this.union(j6)}}let Q=$.children;for(let H=0,k=Q.length;H<k;H++)this.expandByObject(Q[H],J);return this}containsPoint($){return $.x>=this.min.x&&$.x<=this.max.x&&$.y>=this.min.y&&$.y<=this.max.y&&$.z>=this.min.z&&$.z<=this.max.z}containsBox($){return this.min.x<=$.min.x&&$.max.x<=this.max.x&&this.min.y<=$.min.y&&$.max.y<=this.max.y&&this.min.z<=$.min.z&&$.max.z<=this.max.z}getParameter($,J){return J.set(($.x-this.min.x)/(this.max.x-this.min.x),($.y-this.min.y)/(this.max.y-this.min.y),($.z-this.min.z)/(this.max.z-this.min.z))}intersectsBox($){return $.max.x>=this.min.x&&$.min.x<=this.max.x&&$.max.y>=this.min.y&&$.min.y<=this.max.y&&$.max.z>=this.min.z&&$.min.z<=this.max.z}intersectsSphere($){return this.clampPoint($.center,K5),K5.distanceToSquared($.center)<=$.radius*$.radius}intersectsPlane($){let J,M;if($.normal.x>0)J=$.normal.x*this.min.x,M=$.normal.x*this.max.x;else J=$.normal.x*this.max.x,M=$.normal.x*this.min.x;if($.normal.y>0)J+=$.normal.y*this.min.y,M+=$.normal.y*this.max.y;else J+=$.normal.y*this.max.y,M+=$.normal.y*this.min.y;if($.normal.z>0)J+=$.normal.z*this.min.z,M+=$.normal.z*this.max.z;else J+=$.normal.z*this.max.z,M+=$.normal.z*this.min.z;return J<=-$.constant&&M>=-$.constant}intersectsTriangle($){if(this.isEmpty())return!1;this.getCenter($6),v6.subVectors(this.max,$6),X8.subVectors($.a,$6),G8.subVectors($.b,$6),D8.subVectors($.c,$6),S5.subVectors(G8,X8),T5.subVectors(D8,G8),n5.subVectors(X8,D8);let J=[0,-S5.z,S5.y,0,-T5.z,T5.y,0,-n5.z,n5.y,S5.z,0,-S5.x,T5.z,0,-T5.x,n5.z,0,-n5.x,-S5.y,S5.x,0,-T5.y,T5.x,0,-n5.y,n5.x,0];if(!K9(J,X8,G8,D8,v6))return!1;if(J=[1,0,0,0,1,0,0,0,1],!K9(J,X8,G8,D8,v6))return!1;return b6.crossVectors(S5,T5),J=[b6.x,b6.y,b6.z],K9(J,X8,G8,D8,v6)}clampPoint($,J){return J.copy($).clamp(this.min,this.max)}distanceToPoint($){return this.clampPoint($,K5).distanceTo($)}getBoundingSphere($){if(this.isEmpty())$.makeEmpty();else this.getCenter($.center),$.radius=this.getSize(K5).length()*0.5;return $}intersect($){if(this.min.max($.min),this.max.min($.max),this.isEmpty())this.makeEmpty();return this}union($){return this.min.min($.min),this.max.max($.max),this}applyMatrix4($){if(this.isEmpty())return this;return F5[0].set(this.min.x,this.min.y,this.min.z).applyMatrix4($),F5[1].set(this.min.x,this.min.y,this.max.z).applyMatrix4($),F5[2].set(this.min.x,this.max.y,this.min.z).applyMatrix4($),F5[3].set(this.min.x,this.max.y,this.max.z).applyMatrix4($),F5[4].set(this.max.x,this.min.y,this.min.z).applyMatrix4($),F5[5].set(this.max.x,this.min.y,this.max.z).applyMatrix4($),F5[6].set(this.max.x,this.max.y,this.min.z).applyMatrix4($),F5[7].set(this.max.x,this.max.y,this.max.z).applyMatrix4($),this.setFromPoints(F5),this}translate($){return this.min.add($),this.max.add($),this}equals($){return $.min.equals(this.min)&&$.max.equals(this.max)}toJSON(){return{min:this.min.toArray(),max:this.max.toArray()}}fromJSON($){return this.min.fromArray($.min),this.max.fromArray($.max),this}}var F5=[new A,new A,new A,new A,new A,new A,new A,new A],K5=new A,j6=new $8,X8=new A,G8=new A,D8=new A,S5=new A,T5=new A,n5=new A,$6=new A,v6=new A,b6=new A,s5=new A;function K9($,J,M,Q,H){for(let k=0,K=$.length-3;k<=K;k+=3){s5.fromArray($,k);let w=H.x*Math.abs(s5.x)+H.y*Math.abs(s5.y)+H.z*Math.abs(s5.z),W=J.dot(s5),E=M.dot(s5),R=Q.dot(s5);if(Math.max(-Math.max(W,E,R),Math.min(W,E,R))>w)return!1}return!0}var CH=new $8,J6=new A,w9=new A;class x5{constructor($=new A,J=-1){this.isSphere=!0,this.center=$,this.radius=J}set($,J){return this.center.copy($),this.radius=J,this}setFromPoints($,J){let M=this.center;if(J!==void 0)M.copy(J);else CH.setFromPoints($).getCenter(M);let Q=0;for(let H=0,k=$.length;H<k;H++)Q=Math.max(Q,M.distanceToSquared($[H]));return this.radius=Math.sqrt(Q),this}copy($){return this.center.copy($.center),this.radius=$.radius,this}isEmpty(){return this.radius<0}makeEmpty(){return this.center.set(0,0,0),this.radius=-1,this}containsPoint($){return $.distanceToSquared(this.center)<=this.radius*this.radius}distanceToPoint($){return $.distanceTo(this.center)-this.radius}intersectsSphere($){let J=this.radius+$.radius;return $.center.distanceToSquared(this.center)<=J*J}intersectsBox($){return $.intersectsSphere(this)}intersectsPlane($){return Math.abs($.distanceToPoint(this.center))<=this.radius}clampPoint($,J){let M=this.center.distanceToSquared($);if(J.copy($),M>this.radius*this.radius)J.sub(this.center).normalize(),J.multiplyScalar(this.radius).add(this.center);return J}getBoundingBox($){if(this.isEmpty())return $.makeEmpty(),$;return $.set(this.center,this.center),$.expandByScalar(this.radius),$}applyMatrix4($){return this.center.applyMatrix4($),this.radius=this.radius*$.getMaxScaleOnAxis(),this}translate($){return this.center.add($),this}expandByPoint($){if(this.isEmpty())return this.center.copy($),this.radius=0,this;J6.subVectors($,this.center);let J=J6.lengthSq();if(J>this.radius*this.radius){let M=Math.sqrt(J),Q=(M-this.radius)*0.5;this.center.addScaledVector(J6,Q/M),this.radius+=Q}return this}union($){if($.isEmpty())return this;if(this.isEmpty())return this.copy($),this;if(this.center.equals($.center)===!0)this.radius=Math.max(this.radius,$.radius);else w9.subVectors($.center,this.center).setLength($.radius),this.expandByPoint(J6.copy($.center).add(w9)),this.expandByPoint(J6.copy($.center).sub(w9));return this}equals($){return $.center.equals(this.center)&&$.radius===this.radius}clone(){return new this.constructor().copy(this)}toJSON(){return{radius:this.radius,center:this.center.toArray()}}fromJSON($){return this.radius=$.radius,this.center.fromArray($.center),this}}var L5=new A,W9=new A,p6=new A,h5=new A,E9=new A,x6=new A,Z9=new A;class y8{constructor($=new A,J=new A(0,0,-1)){this.origin=$,this.direction=J}set($,J){return this.origin.copy($),this.direction.copy(J),this}copy($){return this.origin.copy($.origin),this.direction.copy($.direction),this}at($,J){return J.copy(this.origin).addScaledVector(this.direction,$)}lookAt($){return this.direction.copy($).sub(this.origin).normalize(),this}recast($){return this.origin.copy(this.at($,L5)),this}closestPointToPoint($,J){J.subVectors($,this.origin);let M=J.dot(this.direction);if(M<0)return J.copy(this.origin);return J.copy(this.origin).addScaledVector(this.direction,M)}distanceToPoint($){return Math.sqrt(this.distanceSqToPoint($))}distanceSqToPoint($){let J=L5.subVectors($,this.origin).dot(this.direction);if(J<0)return this.origin.distanceToSquared($);return L5.copy(this.origin).addScaledVector(this.direction,J),L5.distanceToSquared($)}distanceSqToSegment($,J,M,Q){W9.copy($).add(J).multiplyScalar(0.5),p6.copy(J).sub($).normalize(),h5.copy(this.origin).sub(W9);let H=$.distanceTo(J)*0.5,k=-this.direction.dot(p6),K=h5.dot(this.direction),w=-h5.dot(p6),W=h5.lengthSq(),E=Math.abs(1-k*k),R,Z,U,X;if(E>0)if(R=k*w-K,Z=k*K-w,X=H*E,R>=0)if(Z>=-X)if(Z<=X){let G=1/E;R*=G,Z*=G,U=R*(R+k*Z+2*K)+Z*(k*R+Z+2*w)+W}else Z=H,R=Math.max(0,-(k*Z+K)),U=-R*R+Z*(Z+2*w)+W;else Z=-H,R=Math.max(0,-(k*Z+K)),U=-R*R+Z*(Z+2*w)+W;else if(Z<=-X)R=Math.max(0,-(-k*H+K)),Z=R>0?-H:Math.min(Math.max(-H,-w),H),U=-R*R+Z*(Z+2*w)+W;else if(Z<=X)R=0,Z=Math.min(Math.max(-H,-w),H),U=Z*(Z+2*w)+W;else R=Math.max(0,-(k*H+K)),Z=R>0?H:Math.min(Math.max(-H,-w),H),U=-R*R+Z*(Z+2*w)+W;else Z=k>0?-H:H,R=Math.max(0,-(k*Z+K)),U=-R*R+Z*(Z+2*w)+W;if(M)M.copy(this.origin).addScaledVector(this.direction,R);if(Q)Q.copy(W9).addScaledVector(p6,Z);return U}intersectSphere($,J){L5.subVectors($.center,this.origin);let M=L5.dot(this.direction),Q=L5.dot(L5)-M*M,H=$.radius*$.radius;if(Q>H)return null;let k=Math.sqrt(H-Q),K=M-k,w=M+k;if(w<0)return null;if(K<0)return this.at(w,J);return this.at(K,J)}intersectsSphere($){if($.radius<0)return!1;return this.distanceSqToPoint($.center)<=$.radius*$.radius}distanceToPlane($){let J=$.normal.dot(this.direction);if(J===0){if($.distanceToPoint(this.origin)===0)return 0;return null}let M=-(this.origin.dot($.normal)+$.constant)/J;return M>=0?M:null}intersectPlane($,J){let M=this.distanceToPlane($);if(M===null)return null;return this.at(M,J)}intersectsPlane($){let J=$.distanceToPoint(this.origin);if(J===0)return!0;if($.normal.dot(this.direction)*J<0)return!0;return!1}intersectBox($,J){let M,Q,H,k,K,w,W=1/this.direction.x,E=1/this.direction.y,R=1/this.direction.z,Z=this.origin;if(W>=0)M=($.min.x-Z.x)*W,Q=($.max.x-Z.x)*W;else M=($.max.x-Z.x)*W,Q=($.min.x-Z.x)*W;if(E>=0)H=($.min.y-Z.y)*E,k=($.max.y-Z.y)*E;else H=($.max.y-Z.y)*E,k=($.min.y-Z.y)*E;if(M>k||H>Q)return null;if(H>M||isNaN(M))M=H;if(k<Q||isNaN(Q))Q=k;if(R>=0)K=($.min.z-Z.z)*R,w=($.max.z-Z.z)*R;else K=($.max.z-Z.z)*R,w=($.min.z-Z.z)*R;if(M>w||K>Q)return null;if(K>M||M!==M)M=K;if(w<Q||Q!==Q)Q=w;if(Q<0)return null;return this.at(M>=0?M:Q,J)}intersectsBox($){return this.intersectBox($,L5)!==null}intersectTriangle($,J,M,Q,H){E9.subVectors(J,$),x6.subVectors(M,$),Z9.crossVectors(E9,x6);let k=this.direction.dot(Z9),K;if(k>0){if(Q)return null;K=1}else if(k<0)K=-1,k=-k;else return null;h5.subVectors(this.origin,$);let w=K*this.direction.dot(x6.crossVectors(h5,x6));if(w<0)return null;let W=K*this.direction.dot(E9.cross(h5));if(W<0)return null;if(w+W>k)return null;let E=-K*h5.dot(Z9);if(E<0)return null;return this.at(E/k,H)}applyMatrix4($){return this.origin.applyMatrix4($),this.direction.transformDirection($),this}equals($){return $.origin.equals(this.origin)&&$.direction.equals(this.direction)}clone(){return new this.constructor().copy(this)}}class H1{constructor($,J,M,Q,H,k,K,w,W,E,R,Z,U,X,G,q){if(H1.prototype.isMatrix4=!0,this.elements=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],$!==void 0)this.set($,J,M,Q,H,k,K,w,W,E,R,Z,U,X,G,q)}set($,J,M,Q,H,k,K,w,W,E,R,Z,U,X,G,q){let Y=this.elements;return Y[0]=$,Y[4]=J,Y[8]=M,Y[12]=Q,Y[1]=H,Y[5]=k,Y[9]=K,Y[13]=w,Y[2]=W,Y[6]=E,Y[10]=R,Y[14]=Z,Y[3]=U,Y[7]=X,Y[11]=G,Y[15]=q,this}identity(){return this.set(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1),this}clone(){return new H1().fromArray(this.elements)}copy($){let J=this.elements,M=$.elements;return J[0]=M[0],J[1]=M[1],J[2]=M[2],J[3]=M[3],J[4]=M[4],J[5]=M[5],J[6]=M[6],J[7]=M[7],J[8]=M[8],J[9]=M[9],J[10]=M[10],J[11]=M[11],J[12]=M[12],J[13]=M[13],J[14]=M[14],J[15]=M[15],this}copyPosition($){let J=this.elements,M=$.elements;return J[12]=M[12],J[13]=M[13],J[14]=M[14],this}setFromMatrix3($){let J=$.elements;return this.set(J[0],J[3],J[6],0,J[1],J[4],J[7],0,J[2],J[5],J[8],0,0,0,0,1),this}extractBasis($,J,M){return $.setFromMatrixColumn(this,0),J.setFromMatrixColumn(this,1),M.setFromMatrixColumn(this,2),this}makeBasis($,J,M){return this.set($.x,J.x,M.x,0,$.y,J.y,M.y,0,$.z,J.z,M.z,0,0,0,0,1),this}extractRotation($){let J=this.elements,M=$.elements,Q=1/q8.setFromMatrixColumn($,0).length(),H=1/q8.setFromMatrixColumn($,1).length(),k=1/q8.setFromMatrixColumn($,2).length();return J[0]=M[0]*Q,J[1]=M[1]*Q,J[2]=M[2]*Q,J[3]=0,J[4]=M[4]*H,J[5]=M[5]*H,J[6]=M[6]*H,J[7]=0,J[8]=M[8]*k,J[9]=M[9]*k,J[10]=M[10]*k,J[11]=0,J[12]=0,J[13]=0,J[14]=0,J[15]=1,this}makeRotationFromEuler($){let J=this.elements,M=$.x,Q=$.y,H=$.z,k=Math.cos(M),K=Math.sin(M),w=Math.cos(Q),W=Math.sin(Q),E=Math.cos(H),R=Math.sin(H);if($.order==="XYZ"){let Z=k*E,U=k*R,X=K*E,G=K*R;J[0]=w*E,J[4]=-w*R,J[8]=W,J[1]=U+X*W,J[5]=Z-G*W,J[9]=-K*w,J[2]=G-Z*W,J[6]=X+U*W,J[10]=k*w}else if($.order==="YXZ"){let Z=w*E,U=w*R,X=W*E,G=W*R;J[0]=Z+G*K,J[4]=X*K-U,J[8]=k*W,J[1]=k*R,J[5]=k*E,J[9]=-K,J[2]=U*K-X,J[6]=G+Z*K,J[10]=k*w}else if($.order==="ZXY"){let Z=w*E,U=w*R,X=W*E,G=W*R;J[0]=Z-G*K,J[4]=-k*R,J[8]=X+U*K,J[1]=U+X*K,J[5]=k*E,J[9]=G-Z*K,J[2]=-k*W,J[6]=K,J[10]=k*w}else if($.order==="ZYX"){let Z=k*E,U=k*R,X=K*E,G=K*R;J[0]=w*E,J[4]=X*W-U,J[8]=Z*W+G,J[1]=w*R,J[5]=G*W+Z,J[9]=U*W-X,J[2]=-W,J[6]=K*w,J[10]=k*w}else if($.order==="YZX"){let Z=k*w,U=k*W,X=K*w,G=K*W;J[0]=w*E,J[4]=G-Z*R,J[8]=X*R+U,J[1]=R,J[5]=k*E,J[9]=-K*E,J[2]=-W*E,J[6]=U*R+X,J[10]=Z-G*R}else if($.order==="XZY"){let Z=k*w,U=k*W,X=K*w,G=K*W;J[0]=w*E,J[4]=-R,J[8]=W*E,J[1]=Z*R+G,J[5]=k*E,J[9]=U*R-X,J[2]=X*R-U,J[6]=K*E,J[10]=G*R+Z}return J[3]=0,J[7]=0,J[11]=0,J[12]=0,J[13]=0,J[14]=0,J[15]=1,this}makeRotationFromQuaternion($){return this.compose(_H,$,AH)}lookAt($,J,M){let Q=this.elements;if(l1.subVectors($,J),l1.lengthSq()===0)l1.z=1;if(l1.normalize(),f5.crossVectors(M,l1),f5.lengthSq()===0){if(Math.abs(M.z)===1)l1.x+=0.0001;else l1.z+=0.0001;l1.normalize(),f5.crossVectors(M,l1)}return f5.normalize(),g6.crossVectors(l1,f5),Q[0]=f5.x,Q[4]=g6.x,Q[8]=l1.x,Q[1]=f5.y,Q[5]=g6.y,Q[9]=l1.y,Q[2]=f5.z,Q[6]=g6.z,Q[10]=l1.z,this}multiply($){return this.multiplyMatrices(this,$)}premultiply($){return this.multiplyMatrices($,this)}multiplyMatrices($,J){let M=$.elements,Q=J.elements,H=this.elements,k=M[0],K=M[4],w=M[8],W=M[12],E=M[1],R=M[5],Z=M[9],U=M[13],X=M[2],G=M[6],q=M[10],Y=M[14],N=M[3],V=M[7],D=M[11],P=M[15],h=Q[0],B=Q[4],S=Q[8],b=Q[12],z=Q[1],O=Q[5],f=Q[9],g=Q[13],p=Q[2],u=Q[6],t=Q[10],m=Q[14],e=Q[3],d=Q[7],Q0=Q[11],w0=Q[15];return H[0]=k*h+K*z+w*p+W*e,H[4]=k*B+K*O+w*u+W*d,H[8]=k*S+K*f+w*t+W*Q0,H[12]=k*b+K*g+w*m+W*w0,H[1]=E*h+R*z+Z*p+U*e,H[5]=E*B+R*O+Z*u+U*d,H[9]=E*S+R*f+Z*t+U*Q0,H[13]=E*b+R*g+Z*m+U*w0,H[2]=X*h+G*z+q*p+Y*e,H[6]=X*B+G*O+q*u+Y*d,H[10]=X*S+G*f+q*t+Y*Q0,H[14]=X*b+G*g+q*m+Y*w0,H[3]=N*h+V*z+D*p+P*e,H[7]=N*B+V*O+D*u+P*d,H[11]=N*S+V*f+D*t+P*Q0,H[15]=N*b+V*g+D*m+P*w0,this}multiplyScalar($){let J=this.elements;return J[0]*=$,J[4]*=$,J[8]*=$,J[12]*=$,J[1]*=$,J[5]*=$,J[9]*=$,J[13]*=$,J[2]*=$,J[6]*=$,J[10]*=$,J[14]*=$,J[3]*=$,J[7]*=$,J[11]*=$,J[15]*=$,this}determinant(){let $=this.elements,J=$[0],M=$[4],Q=$[8],H=$[12],k=$[1],K=$[5],w=$[9],W=$[13],E=$[2],R=$[6],Z=$[10],U=$[14],X=$[3],G=$[7],q=$[11],Y=$[15];return X*(+H*w*R-Q*W*R-H*K*Z+M*W*Z+Q*K*U-M*w*U)+G*(+J*w*U-J*W*Z+H*k*Z-Q*k*U+Q*W*E-H*w*E)+q*(+J*W*R-J*K*U-H*k*R+M*k*U+H*K*E-M*W*E)+Y*(-Q*K*E-J*w*R+J*K*Z+Q*k*R-M*k*Z+M*w*E)}transpose(){let $=this.elements,J;return J=$[1],$[1]=$[4],$[4]=J,J=$[2],$[2]=$[8],$[8]=J,J=$[6],$[6]=$[9],$[9]=J,J=$[3],$[3]=$[12],$[12]=J,J=$[7],$[7]=$[13],$[13]=J,J=$[11],$[11]=$[14],$[14]=J,this}setPosition($,J,M){let Q=this.elements;if($.isVector3)Q[12]=$.x,Q[13]=$.y,Q[14]=$.z;else Q[12]=$,Q[13]=J,Q[14]=M;return this}invert(){let $=this.elements,J=$[0],M=$[1],Q=$[2],H=$[3],k=$[4],K=$[5],w=$[6],W=$[7],E=$[8],R=$[9],Z=$[10],U=$[11],X=$[12],G=$[13],q=$[14],Y=$[15],N=R*q*W-G*Z*W+G*w*U-K*q*U-R*w*Y+K*Z*Y,V=X*Z*W-E*q*W-X*w*U+k*q*U+E*w*Y-k*Z*Y,D=E*G*W-X*R*W+X*K*U-k*G*U-E*K*Y+k*R*Y,P=X*R*w-E*G*w-X*K*Z+k*G*Z+E*K*q-k*R*q,h=J*N+M*V+Q*D+H*P;if(h===0)return this.set(0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0);let B=1/h;return $[0]=N*B,$[1]=(G*Z*H-R*q*H-G*Q*U+M*q*U+R*Q*Y-M*Z*Y)*B,$[2]=(K*q*H-G*w*H+G*Q*W-M*q*W-K*Q*Y+M*w*Y)*B,$[3]=(R*w*H-K*Z*H-R*Q*W+M*Z*W+K*Q*U-M*w*U)*B,$[4]=V*B,$[5]=(E*q*H-X*Z*H+X*Q*U-J*q*U-E*Q*Y+J*Z*Y)*B,$[6]=(X*w*H-k*q*H-X*Q*W+J*q*W+k*Q*Y-J*w*Y)*B,$[7]=(k*Z*H-E*w*H+E*Q*W-J*Z*W-k*Q*U+J*w*U)*B,$[8]=D*B,$[9]=(X*R*H-E*G*H-X*M*U+J*G*U+E*M*Y-J*R*Y)*B,$[10]=(k*G*H-X*K*H+X*M*W-J*G*W-k*M*Y+J*K*Y)*B,$[11]=(E*K*H-k*R*H-E*M*W+J*R*W+k*M*U-J*K*U)*B,$[12]=P*B,$[13]=(E*G*Q-X*R*Q+X*M*Z-J*G*Z-E*M*q+J*R*q)*B,$[14]=(X*K*Q-k*G*Q-X*M*w+J*G*w+k*M*q-J*K*q)*B,$[15]=(k*R*Q-E*K*Q+E*M*w-J*R*w-k*M*Z+J*K*Z)*B,this}scale($){let J=this.elements,M=$.x,Q=$.y,H=$.z;return J[0]*=M,J[4]*=Q,J[8]*=H,J[1]*=M,J[5]*=Q,J[9]*=H,J[2]*=M,J[6]*=Q,J[10]*=H,J[3]*=M,J[7]*=Q,J[11]*=H,this}getMaxScaleOnAxis(){let $=this.elements,J=$[0]*$[0]+$[1]*$[1]+$[2]*$[2],M=$[4]*$[4]+$[5]*$[5]+$[6]*$[6],Q=$[8]*$[8]+$[9]*$[9]+$[10]*$[10];return Math.sqrt(Math.max(J,M,Q))}makeTranslation($,J,M){if($.isVector3)this.set(1,0,0,$.x,0,1,0,$.y,0,0,1,$.z,0,0,0,1);else this.set(1,0,0,$,0,1,0,J,0,0,1,M,0,0,0,1);return this}makeRotationX($){let J=Math.cos($),M=Math.sin($);return this.set(1,0,0,0,0,J,-M,0,0,M,J,0,0,0,0,1),this}makeRotationY($){let J=Math.cos($),M=Math.sin($);return this.set(J,0,M,0,0,1,0,0,-M,0,J,0,0,0,0,1),this}makeRotationZ($){let J=Math.cos($),M=Math.sin($);return this.set(J,-M,0,0,M,J,0,0,0,0,1,0,0,0,0,1),this}makeRotationAxis($,J){let M=Math.cos(J),Q=Math.sin(J),H=1-M,k=$.x,K=$.y,w=$.z,W=H*k,E=H*K;return this.set(W*k+M,W*K-Q*w,W*w+Q*K,0,W*K+Q*w,E*K+M,E*w-Q*k,0,W*w-Q*K,E*w+Q*k,H*w*w+M,0,0,0,0,1),this}makeScale($,J,M){return this.set($,0,0,0,0,J,0,0,0,0,M,0,0,0,0,1),this}makeShear($,J,M,Q,H,k){return this.set(1,M,H,0,$,1,k,0,J,Q,1,0,0,0,0,1),this}compose($,J,M){let Q=this.elements,H=J._x,k=J._y,K=J._z,w=J._w,W=H+H,E=k+k,R=K+K,Z=H*W,U=H*E,X=H*R,G=k*E,q=k*R,Y=K*R,N=w*W,V=w*E,D=w*R,P=M.x,h=M.y,B=M.z;return Q[0]=(1-(G+Y))*P,Q[1]=(U+D)*P,Q[2]=(X-V)*P,Q[3]=0,Q[4]=(U-D)*h,Q[5]=(1-(Z+Y))*h,Q[6]=(q+N)*h,Q[7]=0,Q[8]=(X+V)*B,Q[9]=(q-N)*B,Q[10]=(1-(Z+G))*B,Q[11]=0,Q[12]=$.x,Q[13]=$.y,Q[14]=$.z,Q[15]=1,this}decompose($,J,M){let Q=this.elements,H=q8.set(Q[0],Q[1],Q[2]).length(),k=q8.set(Q[4],Q[5],Q[6]).length(),K=q8.set(Q[8],Q[9],Q[10]).length();if(this.determinant()<0)H=-H;$.x=Q[12],$.y=Q[13],$.z=Q[14],w5.copy(this);let W=1/H,E=1/k,R=1/K;return w5.elements[0]*=W,w5.elements[1]*=W,w5.elements[2]*=W,w5.elements[4]*=E,w5.elements[5]*=E,w5.elements[6]*=E,w5.elements[8]*=R,w5.elements[9]*=R,w5.elements[10]*=R,J.setFromRotationMatrix(w5),M.x=H,M.y=k,M.z=K,this}makePerspective($,J,M,Q,H,k,K=2000,w=!1){let W=this.elements,E=2*H/(J-$),R=2*H/(M-Q),Z=(J+$)/(J-$),U=(M+Q)/(M-Q),X,G;if(w)X=H/(k-H),G=k*H/(k-H);else if(K===2000)X=-(k+H)/(k-H),G=-2*k*H/(k-H);else if(K===2001)X=-k/(k-H),G=-k*H/(k-H);else throw Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: "+K);return W[0]=E,W[4]=0,W[8]=Z,W[12]=0,W[1]=0,W[5]=R,W[9]=U,W[13]=0,W[2]=0,W[6]=0,W[10]=X,W[14]=G,W[3]=0,W[7]=0,W[11]=-1,W[15]=0,this}makeOrthographic($,J,M,Q,H,k,K=2000,w=!1){let W=this.elements,E=2/(J-$),R=2/(M-Q),Z=-(J+$)/(J-$),U=-(M+Q)/(M-Q),X,G;if(w)X=1/(k-H),G=k/(k-H);else if(K===2000)X=-2/(k-H),G=-(k+H)/(k-H);else if(K===2001)X=-1/(k-H),G=-H/(k-H);else throw Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: "+K);return W[0]=E,W[4]=0,W[8]=0,W[12]=Z,W[1]=0,W[5]=R,W[9]=0,W[13]=U,W[2]=0,W[6]=0,W[10]=X,W[14]=G,W[3]=0,W[7]=0,W[11]=0,W[15]=1,this}equals($){let J=this.elements,M=$.elements;for(let Q=0;Q<16;Q++)if(J[Q]!==M[Q])return!1;return!0}fromArray($,J=0){for(let M=0;M<16;M++)this.elements[M]=$[M+J];return this}toArray($=[],J=0){let M=this.elements;return $[J]=M[0],$[J+1]=M[1],$[J+2]=M[2],$[J+3]=M[3],$[J+4]=M[4],$[J+5]=M[5],$[J+6]=M[6],$[J+7]=M[7],$[J+8]=M[8],$[J+9]=M[9],$[J+10]=M[10],$[J+11]=M[11],$[J+12]=M[12],$[J+13]=M[13],$[J+14]=M[14],$[J+15]=M[15],$}}var q8=new A,w5=new H1,_H=new A(0,0,0),AH=new A(1,1,1),f5=new A,g6=new A,l1=new A,VJ=new H1,BJ=new m0;class u1{constructor($=0,J=0,M=0,Q=u1.DEFAULT_ORDER){this.isEuler=!0,this._x=$,this._y=J,this._z=M,this._order=Q}get x(){return this._x}set x($){this._x=$,this._onChangeCallback()}get y(){return this._y}set y($){this._y=$,this._onChangeCallback()}get z(){return this._z}set z($){this._z=$,this._onChangeCallback()}get order(){return this._order}set order($){this._order=$,this._onChangeCallback()}set($,J,M,Q=this._order){return this._x=$,this._y=J,this._z=M,this._order=Q,this._onChangeCallback(),this}clone(){return new this.constructor(this._x,this._y,this._z,this._order)}copy($){return this._x=$._x,this._y=$._y,this._z=$._z,this._order=$._order,this._onChangeCallback(),this}setFromRotationMatrix($,J=this._order,M=!0){let Q=$.elements,H=Q[0],k=Q[4],K=Q[8],w=Q[1],W=Q[5],E=Q[9],R=Q[2],Z=Q[6],U=Q[10];switch(J){case"XYZ":if(this._y=Math.asin(c0(K,-1,1)),Math.abs(K)<0.9999999)this._x=Math.atan2(-E,U),this._z=Math.atan2(-k,H);else this._x=Math.atan2(Z,W),this._z=0;break;case"YXZ":if(this._x=Math.asin(-c0(E,-1,1)),Math.abs(E)<0.9999999)this._y=Math.atan2(K,U),this._z=Math.atan2(w,W);else this._y=Math.atan2(-R,H),this._z=0;break;case"ZXY":if(this._x=Math.asin(c0(Z,-1,1)),Math.abs(Z)<0.9999999)this._y=Math.atan2(-R,U),this._z=Math.atan2(-k,W);else this._y=0,this._z=Math.atan2(w,H);break;case"ZYX":if(this._y=Math.asin(-c0(R,-1,1)),Math.abs(R)<0.9999999)this._x=Math.atan2(Z,U),this._z=Math.atan2(w,H);else this._x=0,this._z=Math.atan2(-k,W);break;case"YZX":if(this._z=Math.asin(c0(w,-1,1)),Math.abs(w)<0.9999999)this._x=Math.atan2(-E,W),this._y=Math.atan2(-R,H);else this._x=0,this._y=Math.atan2(K,U);break;case"XZY":if(this._z=Math.asin(-c0(k,-1,1)),Math.abs(k)<0.9999999)this._x=Math.atan2(Z,W),this._y=Math.atan2(K,H);else this._x=Math.atan2(-E,U),this._y=0;break;default:console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: "+J)}if(this._order=J,M===!0)this._onChangeCallback();return this}setFromQuaternion($,J,M){return VJ.makeRotationFromQuaternion($),this.setFromRotationMatrix(VJ,J,M)}setFromVector3($,J=this._order){return this.set($.x,$.y,$.z,J)}reorder($){return BJ.setFromEuler(this),this.setFromQuaternion(BJ,$)}equals($){return $._x===this._x&&$._y===this._y&&$._z===this._z&&$._order===this._order}fromArray($){if(this._x=$[0],this._y=$[1],this._z=$[2],$[3]!==void 0)this._order=$[3];return this._onChangeCallback(),this}toArray($=[],J=0){return $[J]=this._x,$[J+1]=this._y,$[J+2]=this._z,$[J+3]=this._order,$}_onChange($){return this._onChangeCallback=$,this}_onChangeCallback(){}*[Symbol.iterator](){yield this._x,yield this._y,yield this._z,yield this._order}}u1.DEFAULT_ORDER="XYZ";class F${constructor(){this.mask=1}set($){this.mask=(1<<$|0)>>>0}enable($){this.mask|=1<<$|0}enableAll(){this.mask=-1}toggle($){this.mask^=1<<$|0}disable($){this.mask&=~(1<<$|0)}disableAll(){this.mask=0}test($){return(this.mask&$.mask)!==0}isEnabled($){return(this.mask&(1<<$|0))!==0}}var SH=0,IJ=new A,O8=new m0,P5=new H1,l6=new A,M6=new A,TH=new A,hH=new m0,CJ=new A(1,0,0),_J=new A(0,1,0),AJ=new A(0,0,1),SJ={type:"added"},fH={type:"removed"},F8={type:"childadded",child:null},R9={type:"childremoved",child:null};class h1 extends p5{constructor(){super();this.isObject3D=!0,Object.defineProperty(this,"id",{value:SH++}),this.uuid=N6(),this.name="",this.type="Object3D",this.parent=null,this.children=[],this.up=h1.DEFAULT_UP.clone();let $=new A,J=new u1,M=new m0,Q=new A(1,1,1);function H(){M.setFromEuler(J,!1)}function k(){J.setFromQuaternion(M,void 0,!1)}J._onChange(H),M._onChange(k),Object.defineProperties(this,{position:{configurable:!0,enumerable:!0,value:$},rotation:{configurable:!0,enumerable:!0,value:J},quaternion:{configurable:!0,enumerable:!0,value:M},scale:{configurable:!0,enumerable:!0,value:Q},modelViewMatrix:{value:new H1},normalMatrix:{value:new p0}}),this.matrix=new H1,this.matrixWorld=new H1,this.matrixAutoUpdate=h1.DEFAULT_MATRIX_AUTO_UPDATE,this.matrixWorldAutoUpdate=h1.DEFAULT_MATRIX_WORLD_AUTO_UPDATE,this.matrixWorldNeedsUpdate=!1,this.layers=new F$,this.visible=!0,this.castShadow=!1,this.receiveShadow=!1,this.frustumCulled=!0,this.renderOrder=0,this.animations=[],this.customDepthMaterial=void 0,this.customDistanceMaterial=void 0,this.userData={}}onBeforeShadow(){}onAfterShadow(){}onBeforeRender(){}onAfterRender(){}applyMatrix4($){if(this.matrixAutoUpdate)this.updateMatrix();this.matrix.premultiply($),this.matrix.decompose(this.position,this.quaternion,this.scale)}applyQuaternion($){return this.quaternion.premultiply($),this}setRotationFromAxisAngle($,J){this.quaternion.setFromAxisAngle($,J)}setRotationFromEuler($){this.quaternion.setFromEuler($,!0)}setRotationFromMatrix($){this.quaternion.setFromRotationMatrix($)}setRotationFromQuaternion($){this.quaternion.copy($)}rotateOnAxis($,J){return O8.setFromAxisAngle($,J),this.quaternion.multiply(O8),this}rotateOnWorldAxis($,J){return O8.setFromAxisAngle($,J),this.quaternion.premultiply(O8),this}rotateX($){return this.rotateOnAxis(CJ,$)}rotateY($){return this.rotateOnAxis(_J,$)}rotateZ($){return this.rotateOnAxis(AJ,$)}translateOnAxis($,J){return IJ.copy($).applyQuaternion(this.quaternion),this.position.add(IJ.multiplyScalar(J)),this}translateX($){return this.translateOnAxis(CJ,$)}translateY($){return this.translateOnAxis(_J,$)}translateZ($){return this.translateOnAxis(AJ,$)}localToWorld($){return this.updateWorldMatrix(!0,!1),$.applyMatrix4(this.matrixWorld)}worldToLocal($){return this.updateWorldMatrix(!0,!1),$.applyMatrix4(P5.copy(this.matrixWorld).invert())}lookAt($,J,M){if($.isVector3)l6.copy($);else l6.set($,J,M);let Q=this.parent;if(this.updateWorldMatrix(!0,!1),M6.setFromMatrixPosition(this.matrixWorld),this.isCamera||this.isLight)P5.lookAt(M6,l6,this.up);else P5.lookAt(l6,M6,this.up);if(this.quaternion.setFromRotationMatrix(P5),Q)P5.extractRotation(Q.matrixWorld),O8.setFromRotationMatrix(P5),this.quaternion.premultiply(O8.invert())}add($){if(arguments.length>1){for(let J=0;J<arguments.length;J++)this.add(arguments[J]);return this}if($===this)return console.error("THREE.Object3D.add: object can't be added as a child of itself.",$),this;if($&&$.isObject3D)$.removeFromParent(),$.parent=this,this.children.push($),$.dispatchEvent(SJ),F8.child=$,this.dispatchEvent(F8),F8.child=null;else console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.",$);return this}remove($){if(arguments.length>1){for(let M=0;M<arguments.length;M++)this.remove(arguments[M]);return this}let J=this.children.indexOf($);if(J!==-1)$.parent=null,this.children.splice(J,1),$.dispatchEvent(fH),R9.child=$,this.dispatchEvent(R9),R9.child=null;return this}removeFromParent(){let $=this.parent;if($!==null)$.remove(this);return this}clear(){return this.remove(...this.children)}attach($){if(this.updateWorldMatrix(!0,!1),P5.copy(this.matrixWorld).invert(),$.parent!==null)$.parent.updateWorldMatrix(!0,!1),P5.multiply($.parent.matrixWorld);return $.applyMatrix4(P5),$.removeFromParent(),$.parent=this,this.children.push($),$.updateWorldMatrix(!1,!0),$.dispatchEvent(SJ),F8.child=$,this.dispatchEvent(F8),F8.child=null,this}getObjectById($){return this.getObjectByProperty("id",$)}getObjectByName($){return this.getObjectByProperty("name",$)}getObjectByProperty($,J){if(this[$]===J)return this;for(let M=0,Q=this.children.length;M<Q;M++){let k=this.children[M].getObjectByProperty($,J);if(k!==void 0)return k}return}getObjectsByProperty($,J,M=[]){if(this[$]===J)M.push(this);let Q=this.children;for(let H=0,k=Q.length;H<k;H++)Q[H].getObjectsByProperty($,J,M);return M}getWorldPosition($){return this.updateWorldMatrix(!0,!1),$.setFromMatrixPosition(this.matrixWorld)}getWorldQuaternion($){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(M6,$,TH),$}getWorldScale($){return this.updateWorldMatrix(!0,!1),this.matrixWorld.decompose(M6,hH,$),$}getWorldDirection($){this.updateWorldMatrix(!0,!1);let J=this.matrixWorld.elements;return $.set(J[8],J[9],J[10]).normalize()}raycast(){}traverse($){$(this);let J=this.children;for(let M=0,Q=J.length;M<Q;M++)J[M].traverse($)}traverseVisible($){if(this.visible===!1)return;$(this);let J=this.children;for(let M=0,Q=J.length;M<Q;M++)J[M].traverseVisible($)}traverseAncestors($){let J=this.parent;if(J!==null)$(J),J.traverseAncestors($)}updateMatrix(){this.matrix.compose(this.position,this.quaternion,this.scale),this.matrixWorldNeedsUpdate=!0}updateMatrixWorld($){if(this.matrixAutoUpdate)this.updateMatrix();if(this.matrixWorldNeedsUpdate||$){if(this.matrixWorldAutoUpdate===!0)if(this.parent===null)this.matrixWorld.copy(this.matrix);else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix);this.matrixWorldNeedsUpdate=!1,$=!0}let J=this.children;for(let M=0,Q=J.length;M<Q;M++)J[M].updateMatrixWorld($)}updateWorldMatrix($,J){let M=this.parent;if($===!0&&M!==null)M.updateWorldMatrix(!0,!1);if(this.matrixAutoUpdate)this.updateMatrix();if(this.matrixWorldAutoUpdate===!0)if(this.parent===null)this.matrixWorld.copy(this.matrix);else this.matrixWorld.multiplyMatrices(this.parent.matrixWorld,this.matrix);if(J===!0){let Q=this.children;for(let H=0,k=Q.length;H<k;H++)Q[H].updateWorldMatrix(!1,!0)}}toJSON($){let J=$===void 0||typeof $==="string",M={};if(J)$={geometries:{},materials:{},textures:{},images:{},shapes:{},skeletons:{},animations:{},nodes:{}},M.metadata={version:4.7,type:"Object",generator:"Object3D.toJSON"};let Q={};if(Q.uuid=this.uuid,Q.type=this.type,this.name!=="")Q.name=this.name;if(this.castShadow===!0)Q.castShadow=!0;if(this.receiveShadow===!0)Q.receiveShadow=!0;if(this.visible===!1)Q.visible=!1;if(this.frustumCulled===!1)Q.frustumCulled=!1;if(this.renderOrder!==0)Q.renderOrder=this.renderOrder;if(Object.keys(this.userData).length>0)Q.userData=this.userData;if(Q.layers=this.layers.mask,Q.matrix=this.matrix.toArray(),Q.up=this.up.toArray(),this.matrixAutoUpdate===!1)Q.matrixAutoUpdate=!1;if(this.isInstancedMesh){if(Q.type="InstancedMesh",Q.count=this.count,Q.instanceMatrix=this.instanceMatrix.toJSON(),this.instanceColor!==null)Q.instanceColor=this.instanceColor.toJSON()}if(this.isBatchedMesh){if(Q.type="BatchedMesh",Q.perObjectFrustumCulled=this.perObjectFrustumCulled,Q.sortObjects=this.sortObjects,Q.drawRanges=this._drawRanges,Q.reservedRanges=this._reservedRanges,Q.geometryInfo=this._geometryInfo.map((K)=>({...K,boundingBox:K.boundingBox?K.boundingBox.toJSON():void 0,boundingSphere:K.boundingSphere?K.boundingSphere.toJSON():void 0})),Q.instanceInfo=this._instanceInfo.map((K)=>({...K})),Q.availableInstanceIds=this._availableInstanceIds.slice(),Q.availableGeometryIds=this._availableGeometryIds.slice(),Q.nextIndexStart=this._nextIndexStart,Q.nextVertexStart=this._nextVertexStart,Q.geometryCount=this._geometryCount,Q.maxInstanceCount=this._maxInstanceCount,Q.maxVertexCount=this._maxVertexCount,Q.maxIndexCount=this._maxIndexCount,Q.geometryInitialized=this._geometryInitialized,Q.matricesTexture=this._matricesTexture.toJSON($),Q.indirectTexture=this._indirectTexture.toJSON($),this._colorsTexture!==null)Q.colorsTexture=this._colorsTexture.toJSON($);if(this.boundingSphere!==null)Q.boundingSphere=this.boundingSphere.toJSON();if(this.boundingBox!==null)Q.boundingBox=this.boundingBox.toJSON()}function H(K,w){if(K[w.uuid]===void 0)K[w.uuid]=w.toJSON($);return w.uuid}if(this.isScene){if(this.background){if(this.background.isColor)Q.background=this.background.toJSON();else if(this.background.isTexture)Q.background=this.background.toJSON($).uuid}if(this.environment&&this.environment.isTexture&&this.environment.isRenderTargetTexture!==!0)Q.environment=this.environment.toJSON($).uuid}else if(this.isMesh||this.isLine||this.isPoints){Q.geometry=H($.geometries,this.geometry);let K=this.geometry.parameters;if(K!==void 0&&K.shapes!==void 0){let w=K.shapes;if(Array.isArray(w))for(let W=0,E=w.length;W<E;W++){let R=w[W];H($.shapes,R)}else H($.shapes,w)}}if(this.isSkinnedMesh){if(Q.bindMode=this.bindMode,Q.bindMatrix=this.bindMatrix.toArray(),this.skeleton!==void 0)H($.skeletons,this.skeleton),Q.skeleton=this.skeleton.uuid}if(this.material!==void 0)if(Array.isArray(this.material)){let K=[];for(let w=0,W=this.material.length;w<W;w++)K.push(H($.materials,this.material[w]));Q.material=K}else Q.material=H($.materials,this.material);if(this.children.length>0){Q.children=[];for(let K=0;K<this.children.length;K++)Q.children.push(this.children[K].toJSON($).object)}if(this.animations.length>0){Q.animations=[];for(let K=0;K<this.animations.length;K++){let w=this.animations[K];Q.animations.push(H($.animations,w))}}if(J){let K=k($.geometries),w=k($.materials),W=k($.textures),E=k($.images),R=k($.shapes),Z=k($.skeletons),U=k($.animations),X=k($.nodes);if(K.length>0)M.geometries=K;if(w.length>0)M.materials=w;if(W.length>0)M.textures=W;if(E.length>0)M.images=E;if(R.length>0)M.shapes=R;if(Z.length>0)M.skeletons=Z;if(U.length>0)M.animations=U;if(X.length>0)M.nodes=X}return M.object=Q,M;function k(K){let w=[];for(let W in K){let E=K[W];delete E.metadata,w.push(E)}return w}}clone($){return new this.constructor().copy(this,$)}copy($,J=!0){if(this.name=$.name,this.up.copy($.up),this.position.copy($.position),this.rotation.order=$.rotation.order,this.quaternion.copy($.quaternion),this.scale.copy($.scale),this.matrix.copy($.matrix),this.matrixWorld.copy($.matrixWorld),this.matrixAutoUpdate=$.matrixAutoUpdate,this.matrixWorldAutoUpdate=$.matrixWorldAutoUpdate,this.matrixWorldNeedsUpdate=$.matrixWorldNeedsUpdate,this.layers.mask=$.layers.mask,this.visible=$.visible,this.castShadow=$.castShadow,this.receiveShadow=$.receiveShadow,this.frustumCulled=$.frustumCulled,this.renderOrder=$.renderOrder,this.animations=$.animations.slice(),this.userData=JSON.parse(JSON.stringify($.userData)),J===!0)for(let M=0;M<$.children.length;M++){let Q=$.children[M];this.add(Q.clone())}return this}}h1.DEFAULT_UP=new A(0,1,0);h1.DEFAULT_MATRIX_AUTO_UPDATE=!0;h1.DEFAULT_MATRIX_WORLD_AUTO_UPDATE=!0;var W5=new A,z5=new A,U9=new A,V5=new A,L8=new A,P8=new A,TJ=new A,Y9=new A,N9=new A,X9=new A,G9=new U1,D9=new U1,q9=new U1;class $5{constructor($=new A,J=new A,M=new A){this.a=$,this.b=J,this.c=M}static getNormal($,J,M,Q){Q.subVectors(M,J),W5.subVectors($,J),Q.cross(W5);let H=Q.lengthSq();if(H>0)return Q.multiplyScalar(1/Math.sqrt(H));return Q.set(0,0,0)}static getBarycoord($,J,M,Q,H){W5.subVectors(Q,J),z5.subVectors(M,J),U9.subVectors($,J);let k=W5.dot(W5),K=W5.dot(z5),w=W5.dot(U9),W=z5.dot(z5),E=z5.dot(U9),R=k*W-K*K;if(R===0)return H.set(0,0,0),null;let Z=1/R,U=(W*w-K*E)*Z,X=(k*E-K*w)*Z;return H.set(1-U-X,X,U)}static containsPoint($,J,M,Q){if(this.getBarycoord($,J,M,Q,V5)===null)return!1;return V5.x>=0&&V5.y>=0&&V5.x+V5.y<=1}static getInterpolation($,J,M,Q,H,k,K,w){if(this.getBarycoord($,J,M,Q,V5)===null){if(w.x=0,w.y=0,"z"in w)w.z=0;if("w"in w)w.w=0;return null}return w.setScalar(0),w.addScaledVector(H,V5.x),w.addScaledVector(k,V5.y),w.addScaledVector(K,V5.z),w}static getInterpolatedAttribute($,J,M,Q,H,k){return G9.setScalar(0),D9.setScalar(0),q9.setScalar(0),G9.fromBufferAttribute($,J),D9.fromBufferAttribute($,M),q9.fromBufferAttribute($,Q),k.setScalar(0),k.addScaledVector(G9,H.x),k.addScaledVector(D9,H.y),k.addScaledVector(q9,H.z),k}static isFrontFacing($,J,M,Q){return W5.subVectors(M,J),z5.subVectors($,J),W5.cross(z5).dot(Q)<0?!0:!1}set($,J,M){return this.a.copy($),this.b.copy(J),this.c.copy(M),this}setFromPointsAndIndices($,J,M,Q){return this.a.copy($[J]),this.b.copy($[M]),this.c.copy($[Q]),this}setFromAttributeAndIndices($,J,M,Q){return this.a.fromBufferAttribute($,J),this.b.fromBufferAttribute($,M),this.c.fromBufferAttribute($,Q),this}clone(){return new this.constructor().copy(this)}copy($){return this.a.copy($.a),this.b.copy($.b),this.c.copy($.c),this}getArea(){return W5.subVectors(this.c,this.b),z5.subVectors(this.a,this.b),W5.cross(z5).length()*0.5}getMidpoint($){return $.addVectors(this.a,this.b).add(this.c).multiplyScalar(0.3333333333333333)}getNormal($){return $5.getNormal(this.a,this.b,this.c,$)}getPlane($){return $.setFromCoplanarPoints(this.a,this.b,this.c)}getBarycoord($,J){return $5.getBarycoord($,this.a,this.b,this.c,J)}getInterpolation($,J,M,Q,H){return $5.getInterpolation($,this.a,this.b,this.c,J,M,Q,H)}containsPoint($){return $5.containsPoint($,this.a,this.b,this.c)}isFrontFacing($){return $5.isFrontFacing(this.a,this.b,this.c,$)}intersectsBox($){return $.intersectsTriangle(this)}closestPointToPoint($,J){let M=this.a,Q=this.b,H=this.c,k,K;L8.subVectors(Q,M),P8.subVectors(H,M),Y9.subVectors($,M);let w=L8.dot(Y9),W=P8.dot(Y9);if(w<=0&&W<=0)return J.copy(M);N9.subVectors($,Q);let E=L8.dot(N9),R=P8.dot(N9);if(E>=0&&R<=E)return J.copy(Q);let Z=w*R-E*W;if(Z<=0&&w>=0&&E<=0)return k=w/(w-E),J.copy(M).addScaledVector(L8,k);X9.subVectors($,H);let U=L8.dot(X9),X=P8.dot(X9);if(X>=0&&U<=X)return J.copy(H);let G=U*W-w*X;if(G<=0&&W>=0&&X<=0)return K=W/(W-X),J.copy(M).addScaledVector(P8,K);let q=E*X-U*R;if(q<=0&&R-E>=0&&U-X>=0)return TJ.subVectors(H,Q),K=(R-E)/(R-E+(U-X)),J.copy(Q).addScaledVector(TJ,K);let Y=1/(q+G+Z);return k=G*Y,K=Z*Y,J.copy(M).addScaledVector(L8,k).addScaledVector(P8,K)}equals($){return $.a.equals(this.a)&&$.b.equals(this.b)&&$.c.equals(this.c)}}var nM={aliceblue:15792383,antiquewhite:16444375,aqua:65535,aquamarine:8388564,azure:15794175,beige:16119260,bisque:16770244,black:0,blanchedalmond:16772045,blue:255,blueviolet:9055202,brown:10824234,burlywood:14596231,cadetblue:6266528,chartreuse:8388352,chocolate:13789470,coral:16744272,cornflowerblue:6591981,cornsilk:16775388,crimson:14423100,cyan:65535,darkblue:139,darkcyan:35723,darkgoldenrod:12092939,darkgray:11119017,darkgreen:25600,darkgrey:11119017,darkkhaki:12433259,darkmagenta:9109643,darkolivegreen:5597999,darkorange:16747520,darkorchid:10040012,darkred:9109504,darksalmon:15308410,darkseagreen:9419919,darkslateblue:4734347,darkslategray:3100495,darkslategrey:3100495,darkturquoise:52945,darkviolet:9699539,deeppink:16716947,deepskyblue:49151,dimgray:6908265,dimgrey:6908265,dodgerblue:2003199,firebrick:11674146,floralwhite:16775920,forestgreen:2263842,fuchsia:16711935,gainsboro:14474460,ghostwhite:16316671,gold:16766720,goldenrod:14329120,gray:8421504,green:32768,greenyellow:11403055,grey:8421504,honeydew:15794160,hotpink:16738740,indianred:13458524,indigo:4915330,ivory:16777200,khaki:15787660,lavender:15132410,lavenderblush:16773365,lawngreen:8190976,lemonchiffon:16775885,lightblue:11393254,lightcoral:15761536,lightcyan:14745599,lightgoldenrodyellow:16448210,lightgray:13882323,lightgreen:9498256,lightgrey:13882323,lightpink:16758465,lightsalmon:16752762,lightseagreen:2142890,lightskyblue:8900346,lightslategray:7833753,lightslategrey:7833753,lightsteelblue:11584734,lightyellow:16777184,lime:65280,limegreen:3329330,linen:16445670,magenta:16711935,maroon:8388608,mediumaquamarine:6737322,mediumblue:205,mediumorchid:12211667,mediumpurple:9662683,mediumseagreen:3978097,mediumslateblue:8087790,mediumspringgreen:64154,mediumturquoise:4772300,mediumvioletred:13047173,midnightblue:1644912,mintcream:16121850,mistyrose:16770273,moccasin:16770229,navajowhite:16768685,navy:128,oldlace:16643558,olive:8421376,olivedrab:7048739,orange:16753920,orangered:16729344,orchid:14315734,palegoldenrod:15657130,palegreen:10025880,paleturquoise:11529966,palevioletred:14381203,papayawhip:16773077,peachpuff:16767673,peru:13468991,pink:16761035,plum:14524637,powderblue:11591910,purple:8388736,rebeccapurple:6697881,red:16711680,rosybrown:12357519,royalblue:4286945,saddlebrown:9127187,salmon:16416882,sandybrown:16032864,seagreen:3050327,seashell:16774638,sienna:10506797,silver:12632256,skyblue:8900331,slateblue:6970061,slategray:7372944,slategrey:7372944,snow:16775930,springgreen:65407,steelblue:4620980,tan:13808780,teal:32896,thistle:14204888,tomato:16737095,turquoise:4251856,violet:15631086,wheat:16113331,white:16777215,whitesmoke:16119285,yellow:16776960,yellowgreen:10145074},y5={h:0,s:0,l:0},d6={h:0,s:0,l:0};function O9($,J,M){if(M<0)M+=1;if(M>1)M-=1;if(M<0.16666666666666666)return $+(J-$)*6*M;if(M<0.5)return J;if(M<0.6666666666666666)return $+(J-$)*6*(0.6666666666666666-M);return $}class e0{constructor($,J,M){return this.isColor=!0,this.r=1,this.g=1,this.b=1,this.set($,J,M)}set($,J,M){if(J===void 0&&M===void 0){let Q=$;if(Q&&Q.isColor)this.copy(Q);else if(typeof Q==="number")this.setHex(Q);else if(typeof Q==="string")this.setStyle(Q)}else this.setRGB($,J,M);return this}setScalar($){return this.r=$,this.g=$,this.b=$,this}setHex($,J="srgb"){return $=Math.floor($),this.r=($>>16&255)/255,this.g=($>>8&255)/255,this.b=($&255)/255,r0.colorSpaceToWorking(this,J),this}setRGB($,J,M,Q=r0.workingColorSpace){return this.r=$,this.g=J,this.b=M,r0.colorSpaceToWorking(this,Q),this}setHSL($,J,M,Q=r0.workingColorSpace){if($=zH($,1),J=c0(J,0,1),M=c0(M,0,1),J===0)this.r=this.g=this.b=M;else{let H=M<=0.5?M*(1+J):M+J-M*J,k=2*M-H;this.r=O9(k,H,$+0.3333333333333333),this.g=O9(k,H,$),this.b=O9(k,H,$-0.3333333333333333)}return r0.colorSpaceToWorking(this,Q),this}setStyle($,J="srgb"){function M(H){if(H===void 0)return;if(parseFloat(H)<1)console.warn("THREE.Color: Alpha component of "+$+" will be ignored.")}let Q;if(Q=/^(\w+)\(([^\)]*)\)/.exec($)){let H,k=Q[1],K=Q[2];switch(k){case"rgb":case"rgba":if(H=/^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(K))return M(H[4]),this.setRGB(Math.min(255,parseInt(H[1],10))/255,Math.min(255,parseInt(H[2],10))/255,Math.min(255,parseInt(H[3],10))/255,J);if(H=/^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(K))return M(H[4]),this.setRGB(Math.min(100,parseInt(H[1],10))/100,Math.min(100,parseInt(H[2],10))/100,Math.min(100,parseInt(H[3],10))/100,J);break;case"hsl":case"hsla":if(H=/^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(K))return M(H[4]),this.setHSL(parseFloat(H[1])/360,parseFloat(H[2])/100,parseFloat(H[3])/100,J);break;default:console.warn("THREE.Color: Unknown color model "+$)}}else if(Q=/^\#([A-Fa-f\d]+)$/.exec($)){let H=Q[1],k=H.length;if(k===3)return this.setRGB(parseInt(H.charAt(0),16)/15,parseInt(H.charAt(1),16)/15,parseInt(H.charAt(2),16)/15,J);else if(k===6)return this.setHex(parseInt(H,16),J);else console.warn("THREE.Color: Invalid hex color "+$)}else if($&&$.length>0)return this.setColorName($,J);return this}setColorName($,J="srgb"){let M=nM[$.toLowerCase()];if(M!==void 0)this.setHex(M,J);else console.warn("THREE.Color: Unknown color "+$);return this}clone(){return new this.constructor(this.r,this.g,this.b)}copy($){return this.r=$.r,this.g=$.g,this.b=$.b,this}copySRGBToLinear($){return this.r=B5($.r),this.g=B5($.g),this.b=B5($.b),this}copyLinearToSRGB($){return this.r=C8($.r),this.g=C8($.g),this.b=C8($.b),this}convertSRGBToLinear(){return this.copySRGBToLinear(this),this}convertLinearToSRGB(){return this.copyLinearToSRGB(this),this}getHex($="srgb"){return r0.workingToColorSpace(C1.copy(this),$),Math.round(c0(C1.r*255,0,255))*65536+Math.round(c0(C1.g*255,0,255))*256+Math.round(c0(C1.b*255,0,255))}getHexString($="srgb"){return("000000"+this.getHex($).toString(16)).slice(-6)}getHSL($,J=r0.workingColorSpace){r0.workingToColorSpace(C1.copy(this),J);let{r:M,g:Q,b:H}=C1,k=Math.max(M,Q,H),K=Math.min(M,Q,H),w,W,E=(K+k)/2;if(K===k)w=0,W=0;else{let R=k-K;switch(W=E<=0.5?R/(k+K):R/(2-k-K),k){case M:w=(Q-H)/R+(Q<H?6:0);break;case Q:w=(H-M)/R+2;break;case H:w=(M-Q)/R+4;break}w/=6}return $.h=w,$.s=W,$.l=E,$}getRGB($,J=r0.workingColorSpace){return r0.workingToColorSpace(C1.copy(this),J),$.r=C1.r,$.g=C1.g,$.b=C1.b,$}getStyle($="srgb"){r0.workingToColorSpace(C1.copy(this),$);let{r:J,g:M,b:Q}=C1;if($!=="srgb")return`color(${$} ${J.toFixed(3)} ${M.toFixed(3)} ${Q.toFixed(3)})`;return`rgb(${Math.round(J*255)},${Math.round(M*255)},${Math.round(Q*255)})`}offsetHSL($,J,M){return this.getHSL(y5),this.setHSL(y5.h+$,y5.s+J,y5.l+M)}add($){return this.r+=$.r,this.g+=$.g,this.b+=$.b,this}addColors($,J){return this.r=$.r+J.r,this.g=$.g+J.g,this.b=$.b+J.b,this}addScalar($){return this.r+=$,this.g+=$,this.b+=$,this}sub($){return this.r=Math.max(0,this.r-$.r),this.g=Math.max(0,this.g-$.g),this.b=Math.max(0,this.b-$.b),this}multiply($){return this.r*=$.r,this.g*=$.g,this.b*=$.b,this}multiplyScalar($){return this.r*=$,this.g*=$,this.b*=$,this}lerp($,J){return this.r+=($.r-this.r)*J,this.g+=($.g-this.g)*J,this.b+=($.b-this.b)*J,this}lerpColors($,J,M){return this.r=$.r+(J.r-$.r)*M,this.g=$.g+(J.g-$.g)*M,this.b=$.b+(J.b-$.b)*M,this}lerpHSL($,J){this.getHSL(y5),$.getHSL(d6);let M=J9(y5.h,d6.h,J),Q=J9(y5.s,d6.s,J),H=J9(y5.l,d6.l,J);return this.setHSL(M,Q,H),this}setFromVector3($){return this.r=$.x,this.g=$.y,this.b=$.z,this}applyMatrix3($){let J=this.r,M=this.g,Q=this.b,H=$.elements;return this.r=H[0]*J+H[3]*M+H[6]*Q,this.g=H[1]*J+H[4]*M+H[7]*Q,this.b=H[2]*J+H[5]*M+H[8]*Q,this}equals($){return $.r===this.r&&$.g===this.g&&$.b===this.b}fromArray($,J=0){return this.r=$[J],this.g=$[J+1],this.b=$[J+2],this}toArray($=[],J=0){return $[J]=this.r,$[J+1]=this.g,$[J+2]=this.b,$}fromBufferAttribute($,J){return this.r=$.getX(J),this.g=$.getY(J),this.b=$.getZ(J),this}toJSON(){return this.getHex()}*[Symbol.iterator](){yield this.r,yield this.g,yield this.b}}var C1=new e0;e0.NAMES=nM;var yH=0;class J8 extends p5{constructor(){super();this.isMaterial=!0,Object.defineProperty(this,"id",{value:yH++}),this.uuid=N6(),this.name="",this.type="Material",this.blending=1,this.side=0,this.vertexColors=!1,this.opacity=1,this.transparent=!1,this.alphaHash=!1,this.blendSrc=204,this.blendDst=205,this.blendEquation=100,this.blendSrcAlpha=null,this.blendDstAlpha=null,this.blendEquationAlpha=null,this.blendColor=new e0(0,0,0),this.blendAlpha=0,this.depthFunc=3,this.depthTest=!0,this.depthWrite=!0,this.stencilWriteMask=255,this.stencilFunc=519,this.stencilRef=0,this.stencilFuncMask=255,this.stencilFail=7680,this.stencilZFail=7680,this.stencilZPass=7680,this.stencilWrite=!1,this.clippingPlanes=null,this.clipIntersection=!1,this.clipShadows=!1,this.shadowSide=null,this.colorWrite=!0,this.precision=null,this.polygonOffset=!1,this.polygonOffsetFactor=0,this.polygonOffsetUnits=0,this.dithering=!1,this.alphaToCoverage=!1,this.premultipliedAlpha=!1,this.forceSinglePass=!1,this.allowOverride=!0,this.visible=!0,this.toneMapped=!0,this.userData={},this.version=0,this._alphaTest=0}get alphaTest(){return this._alphaTest}set alphaTest($){if(this._alphaTest>0!==$>0)this.version++;this._alphaTest=$}onBeforeRender(){}onBeforeCompile(){}customProgramCacheKey(){return this.onBeforeCompile.toString()}setValues($){if($===void 0)return;for(let J in $){let M=$[J];if(M===void 0){console.warn(`THREE.Material: parameter '${J}' has value of undefined.`);continue}let Q=this[J];if(Q===void 0){console.warn(`THREE.Material: '${J}' is not a property of THREE.${this.type}.`);continue}if(Q&&Q.isColor)Q.set(M);else if(Q&&Q.isVector3&&(M&&M.isVector3))Q.copy(M);else this[J]=M}}toJSON($){let J=$===void 0||typeof $==="string";if(J)$={textures:{},images:{}};let M={metadata:{version:4.7,type:"Material",generator:"Material.toJSON"}};if(M.uuid=this.uuid,M.type=this.type,this.name!=="")M.name=this.name;if(this.color&&this.color.isColor)M.color=this.color.getHex();if(this.roughness!==void 0)M.roughness=this.roughness;if(this.metalness!==void 0)M.metalness=this.metalness;if(this.sheen!==void 0)M.sheen=this.sheen;if(this.sheenColor&&this.sheenColor.isColor)M.sheenColor=this.sheenColor.getHex();if(this.sheenRoughness!==void 0)M.sheenRoughness=this.sheenRoughness;if(this.emissive&&this.emissive.isColor)M.emissive=this.emissive.getHex();if(this.emissiveIntensity!==void 0&&this.emissiveIntensity!==1)M.emissiveIntensity=this.emissiveIntensity;if(this.specular&&this.specular.isColor)M.specular=this.specular.getHex();if(this.specularIntensity!==void 0)M.specularIntensity=this.specularIntensity;if(this.specularColor&&this.specularColor.isColor)M.specularColor=this.specularColor.getHex();if(this.shininess!==void 0)M.shininess=this.shininess;if(this.clearcoat!==void 0)M.clearcoat=this.clearcoat;if(this.clearcoatRoughness!==void 0)M.clearcoatRoughness=this.clearcoatRoughness;if(this.clearcoatMap&&this.clearcoatMap.isTexture)M.clearcoatMap=this.clearcoatMap.toJSON($).uuid;if(this.clearcoatRoughnessMap&&this.clearcoatRoughnessMap.isTexture)M.clearcoatRoughnessMap=this.clearcoatRoughnessMap.toJSON($).uuid;if(this.clearcoatNormalMap&&this.clearcoatNormalMap.isTexture)M.clearcoatNormalMap=this.clearcoatNormalMap.toJSON($).uuid,M.clearcoatNormalScale=this.clearcoatNormalScale.toArray();if(this.dispersion!==void 0)M.dispersion=this.dispersion;if(this.iridescence!==void 0)M.iridescence=this.iridescence;if(this.iridescenceIOR!==void 0)M.iridescenceIOR=this.iridescenceIOR;if(this.iridescenceThicknessRange!==void 0)M.iridescenceThicknessRange=this.iridescenceThicknessRange;if(this.iridescenceMap&&this.iridescenceMap.isTexture)M.iridescenceMap=this.iridescenceMap.toJSON($).uuid;if(this.iridescenceThicknessMap&&this.iridescenceThicknessMap.isTexture)M.iridescenceThicknessMap=this.iridescenceThicknessMap.toJSON($).uuid;if(this.anisotropy!==void 0)M.anisotropy=this.anisotropy;if(this.anisotropyRotation!==void 0)M.anisotropyRotation=this.anisotropyRotation;if(this.anisotropyMap&&this.anisotropyMap.isTexture)M.anisotropyMap=this.anisotropyMap.toJSON($).uuid;if(this.map&&this.map.isTexture)M.map=this.map.toJSON($).uuid;if(this.matcap&&this.matcap.isTexture)M.matcap=this.matcap.toJSON($).uuid;if(this.alphaMap&&this.alphaMap.isTexture)M.alphaMap=this.alphaMap.toJSON($).uuid;if(this.lightMap&&this.lightMap.isTexture)M.lightMap=this.lightMap.toJSON($).uuid,M.lightMapIntensity=this.lightMapIntensity;if(this.aoMap&&this.aoMap.isTexture)M.aoMap=this.aoMap.toJSON($).uuid,M.aoMapIntensity=this.aoMapIntensity;if(this.bumpMap&&this.bumpMap.isTexture)M.bumpMap=this.bumpMap.toJSON($).uuid,M.bumpScale=this.bumpScale;if(this.normalMap&&this.normalMap.isTexture)M.normalMap=this.normalMap.toJSON($).uuid,M.normalMapType=this.normalMapType,M.normalScale=this.normalScale.toArray();if(this.displacementMap&&this.displacementMap.isTexture)M.displacementMap=this.displacementMap.toJSON($).uuid,M.displacementScale=this.displacementScale,M.displacementBias=this.displacementBias;if(this.roughnessMap&&this.roughnessMap.isTexture)M.roughnessMap=this.roughnessMap.toJSON($).uuid;if(this.metalnessMap&&this.metalnessMap.isTexture)M.metalnessMap=this.metalnessMap.toJSON($).uuid;if(this.emissiveMap&&this.emissiveMap.isTexture)M.emissiveMap=this.emissiveMap.toJSON($).uuid;if(this.specularMap&&this.specularMap.isTexture)M.specularMap=this.specularMap.toJSON($).uuid;if(this.specularIntensityMap&&this.specularIntensityMap.isTexture)M.specularIntensityMap=this.specularIntensityMap.toJSON($).uuid;if(this.specularColorMap&&this.specularColorMap.isTexture)M.specularColorMap=this.specularColorMap.toJSON($).uuid;if(this.envMap&&this.envMap.isTexture){if(M.envMap=this.envMap.toJSON($).uuid,this.combine!==void 0)M.combine=this.combine}if(this.envMapRotation!==void 0)M.envMapRotation=this.envMapRotation.toArray();if(this.envMapIntensity!==void 0)M.envMapIntensity=this.envMapIntensity;if(this.reflectivity!==void 0)M.reflectivity=this.reflectivity;if(this.refractionRatio!==void 0)M.refractionRatio=this.refractionRatio;if(this.gradientMap&&this.gradientMap.isTexture)M.gradientMap=this.gradientMap.toJSON($).uuid;if(this.transmission!==void 0)M.transmission=this.transmission;if(this.transmissionMap&&this.transmissionMap.isTexture)M.transmissionMap=this.transmissionMap.toJSON($).uuid;if(this.thickness!==void 0)M.thickness=this.thickness;if(this.thicknessMap&&this.thicknessMap.isTexture)M.thicknessMap=this.thicknessMap.toJSON($).uuid;if(this.attenuationDistance!==void 0&&this.attenuationDistance!==1/0)M.attenuationDistance=this.attenuationDistance;if(this.attenuationColor!==void 0)M.attenuationColor=this.attenuationColor.getHex();if(this.size!==void 0)M.size=this.size;if(this.shadowSide!==null)M.shadowSide=this.shadowSide;if(this.sizeAttenuation!==void 0)M.sizeAttenuation=this.sizeAttenuation;if(this.blending!==1)M.blending=this.blending;if(this.side!==0)M.side=this.side;if(this.vertexColors===!0)M.vertexColors=!0;if(this.opacity<1)M.opacity=this.opacity;if(this.transparent===!0)M.transparent=!0;if(this.blendSrc!==204)M.blendSrc=this.blendSrc;if(this.blendDst!==205)M.blendDst=this.blendDst;if(this.blendEquation!==100)M.blendEquation=this.blendEquation;if(this.blendSrcAlpha!==null)M.blendSrcAlpha=this.blendSrcAlpha;if(this.blendDstAlpha!==null)M.blendDstAlpha=this.blendDstAlpha;if(this.blendEquationAlpha!==null)M.blendEquationAlpha=this.blendEquationAlpha;if(this.blendColor&&this.blendColor.isColor)M.blendColor=this.blendColor.getHex();if(this.blendAlpha!==0)M.blendAlpha=this.blendAlpha;if(this.depthFunc!==3)M.depthFunc=this.depthFunc;if(this.depthTest===!1)M.depthTest=this.depthTest;if(this.depthWrite===!1)M.depthWrite=this.depthWrite;if(this.colorWrite===!1)M.colorWrite=this.colorWrite;if(this.stencilWriteMask!==255)M.stencilWriteMask=this.stencilWriteMask;if(this.stencilFunc!==519)M.stencilFunc=this.stencilFunc;if(this.stencilRef!==0)M.stencilRef=this.stencilRef;if(this.stencilFuncMask!==255)M.stencilFuncMask=this.stencilFuncMask;if(this.stencilFail!==7680)M.stencilFail=this.stencilFail;if(this.stencilZFail!==7680)M.stencilZFail=this.stencilZFail;if(this.stencilZPass!==7680)M.stencilZPass=this.stencilZPass;if(this.stencilWrite===!0)M.stencilWrite=this.stencilWrite;if(this.rotation!==void 0&&this.rotation!==0)M.rotation=this.rotation;if(this.polygonOffset===!0)M.polygonOffset=!0;if(this.polygonOffsetFactor!==0)M.polygonOffsetFactor=this.polygonOffsetFactor;if(this.polygonOffsetUnits!==0)M.polygonOffsetUnits=this.polygonOffsetUnits;if(this.linewidth!==void 0&&this.linewidth!==1)M.linewidth=this.linewidth;if(this.dashSize!==void 0)M.dashSize=this.dashSize;if(this.gapSize!==void 0)M.gapSize=this.gapSize;if(this.scale!==void 0)M.scale=this.scale;if(this.dithering===!0)M.dithering=!0;if(this.alphaTest>0)M.alphaTest=this.alphaTest;if(this.alphaHash===!0)M.alphaHash=!0;if(this.alphaToCoverage===!0)M.alphaToCoverage=!0;if(this.premultipliedAlpha===!0)M.premultipliedAlpha=!0;if(this.forceSinglePass===!0)M.forceSinglePass=!0;if(this.wireframe===!0)M.wireframe=!0;if(this.wireframeLinewidth>1)M.wireframeLinewidth=this.wireframeLinewidth;if(this.wireframeLinecap!=="round")M.wireframeLinecap=this.wireframeLinecap;if(this.wireframeLinejoin!=="round")M.wireframeLinejoin=this.wireframeLinejoin;if(this.flatShading===!0)M.flatShading=!0;if(this.visible===!1)M.visible=!1;if(this.toneMapped===!1)M.toneMapped=!1;if(this.fog===!1)M.fog=!1;if(Object.keys(this.userData).length>0)M.userData=this.userData;function Q(H){let k=[];for(let K in H){let w=H[K];delete w.metadata,k.push(w)}return k}if(J){let H=Q($.textures),k=Q($.images);if(H.length>0)M.textures=H;if(k.length>0)M.images=k}return M}clone(){return new this.constructor().copy(this)}copy($){this.name=$.name,this.blending=$.blending,this.side=$.side,this.vertexColors=$.vertexColors,this.opacity=$.opacity,this.transparent=$.transparent,this.blendSrc=$.blendSrc,this.blendDst=$.blendDst,this.blendEquation=$.blendEquation,this.blendSrcAlpha=$.blendSrcAlpha,this.blendDstAlpha=$.blendDstAlpha,this.blendEquationAlpha=$.blendEquationAlpha,this.blendColor.copy($.blendColor),this.blendAlpha=$.blendAlpha,this.depthFunc=$.depthFunc,this.depthTest=$.depthTest,this.depthWrite=$.depthWrite,this.stencilWriteMask=$.stencilWriteMask,this.stencilFunc=$.stencilFunc,this.stencilRef=$.stencilRef,this.stencilFuncMask=$.stencilFuncMask,this.stencilFail=$.stencilFail,this.stencilZFail=$.stencilZFail,this.stencilZPass=$.stencilZPass,this.stencilWrite=$.stencilWrite;let J=$.clippingPlanes,M=null;if(J!==null){let Q=J.length;M=Array(Q);for(let H=0;H!==Q;++H)M[H]=J[H].clone()}return this.clippingPlanes=M,this.clipIntersection=$.clipIntersection,this.clipShadows=$.clipShadows,this.shadowSide=$.shadowSide,this.colorWrite=$.colorWrite,this.precision=$.precision,this.polygonOffset=$.polygonOffset,this.polygonOffsetFactor=$.polygonOffsetFactor,this.polygonOffsetUnits=$.polygonOffsetUnits,this.dithering=$.dithering,this.alphaTest=$.alphaTest,this.alphaHash=$.alphaHash,this.alphaToCoverage=$.alphaToCoverage,this.premultipliedAlpha=$.premultipliedAlpha,this.forceSinglePass=$.forceSinglePass,this.visible=$.visible,this.toneMapped=$.toneMapped,this.userData=JSON.parse(JSON.stringify($.userData)),this}dispose(){this.dispatchEvent({type:"dispose"})}set needsUpdate($){if($===!0)this.version++}}class L$ extends J8{constructor($){super();this.isMeshBasicMaterial=!0,this.type="MeshBasicMaterial",this.color=new e0(16777215),this.map=null,this.lightMap=null,this.lightMapIntensity=1,this.aoMap=null,this.aoMapIntensity=1,this.specularMap=null,this.alphaMap=null,this.envMap=null,this.envMapRotation=new u1,this.combine=0,this.reflectivity=1,this.refractionRatio=0.98,this.wireframe=!1,this.wireframeLinewidth=1,this.wireframeLinecap="round",this.wireframeLinejoin="round",this.fog=!0,this.setValues($)}copy($){return super.copy($),this.color.copy($.color),this.map=$.map,this.lightMap=$.lightMap,this.lightMapIntensity=$.lightMapIntensity,this.aoMap=$.aoMap,this.aoMapIntensity=$.aoMapIntensity,this.specularMap=$.specularMap,this.alphaMap=$.alphaMap,this.envMap=$.envMap,this.envMapRotation.copy($.envMapRotation),this.combine=$.combine,this.reflectivity=$.reflectivity,this.refractionRatio=$.refractionRatio,this.wireframe=$.wireframe,this.wireframeLinewidth=$.wireframeLinewidth,this.wireframeLinecap=$.wireframeLinecap,this.wireframeLinejoin=$.wireframeLinejoin,this.fog=$.fog,this}}var Y1=new A,m6=new J1,jH=0;class N1{constructor($,J,M=!1){if(Array.isArray($))throw TypeError("THREE.BufferAttribute: array should be a Typed Array.");this.isBufferAttribute=!0,Object.defineProperty(this,"id",{value:jH++}),this.name="",this.array=$,this.itemSize=J,this.count=$!==void 0?$.length/J:0,this.normalized=M,this.usage=35044,this.updateRanges=[],this.gpuType=1015,this.version=0}onUploadCallback(){}set needsUpdate($){if($===!0)this.version++}setUsage($){return this.usage=$,this}addUpdateRange($,J){this.updateRanges.push({start:$,count:J})}clearUpdateRanges(){this.updateRanges.length=0}copy($){return this.name=$.name,this.array=new $.array.constructor($.array),this.itemSize=$.itemSize,this.count=$.count,this.normalized=$.normalized,this.usage=$.usage,this.gpuType=$.gpuType,this}copyAt($,J,M){$*=this.itemSize,M*=J.itemSize;for(let Q=0,H=this.itemSize;Q<H;Q++)this.array[$+Q]=J.array[M+Q];return this}copyArray($){return this.array.set($),this}applyMatrix3($){if(this.itemSize===2)for(let J=0,M=this.count;J<M;J++)m6.fromBufferAttribute(this,J),m6.applyMatrix3($),this.setXY(J,m6.x,m6.y);else if(this.itemSize===3)for(let J=0,M=this.count;J<M;J++)Y1.fromBufferAttribute(this,J),Y1.applyMatrix3($),this.setXYZ(J,Y1.x,Y1.y,Y1.z);return this}applyMatrix4($){for(let J=0,M=this.count;J<M;J++)Y1.fromBufferAttribute(this,J),Y1.applyMatrix4($),this.setXYZ(J,Y1.x,Y1.y,Y1.z);return this}applyNormalMatrix($){for(let J=0,M=this.count;J<M;J++)Y1.fromBufferAttribute(this,J),Y1.applyNormalMatrix($),this.setXYZ(J,Y1.x,Y1.y,Y1.z);return this}transformDirection($){for(let J=0,M=this.count;J<M;J++)Y1.fromBufferAttribute(this,J),Y1.transformDirection($),this.setXYZ(J,Y1.x,Y1.y,Y1.z);return this}set($,J=0){return this.array.set($,J),this}getComponent($,J){let M=this.array[$*this.itemSize+J];if(this.normalized)M=e8(M,this.array);return M}setComponent($,J,M){if(this.normalized)M=y1(M,this.array);return this.array[$*this.itemSize+J]=M,this}getX($){let J=this.array[$*this.itemSize];if(this.normalized)J=e8(J,this.array);return J}setX($,J){if(this.normalized)J=y1(J,this.array);return this.array[$*this.itemSize]=J,this}getY($){let J=this.array[$*this.itemSize+1];if(this.normalized)J=e8(J,this.array);return J}setY($,J){if(this.normalized)J=y1(J,this.array);return this.array[$*this.itemSize+1]=J,this}getZ($){let J=this.array[$*this.itemSize+2];if(this.normalized)J=e8(J,this.array);return J}setZ($,J){if(this.normalized)J=y1(J,this.array);return this.array[$*this.itemSize+2]=J,this}getW($){let J=this.array[$*this.itemSize+3];if(this.normalized)J=e8(J,this.array);return J}setW($,J){if(this.normalized)J=y1(J,this.array);return this.array[$*this.itemSize+3]=J,this}setXY($,J,M){if($*=this.itemSize,this.normalized)J=y1(J,this.array),M=y1(M,this.array);return this.array[$+0]=J,this.array[$+1]=M,this}setXYZ($,J,M,Q){if($*=this.itemSize,this.normalized)J=y1(J,this.array),M=y1(M,this.array),Q=y1(Q,this.array);return this.array[$+0]=J,this.array[$+1]=M,this.array[$+2]=Q,this}setXYZW($,J,M,Q,H){if($*=this.itemSize,this.normalized)J=y1(J,this.array),M=y1(M,this.array),Q=y1(Q,this.array),H=y1(H,this.array);return this.array[$+0]=J,this.array[$+1]=M,this.array[$+2]=Q,this.array[$+3]=H,this}onUpload($){return this.onUploadCallback=$,this}clone(){return new this.constructor(this.array,this.itemSize).copy(this)}toJSON(){let $={itemSize:this.itemSize,type:this.array.constructor.name,array:Array.from(this.array),normalized:this.normalized};if(this.name!=="")$.name=this.name;if(this.usage!==35044)$.usage=this.usage;return $}}class P$ extends N1{constructor($,J,M){super(new Uint16Array($),J,M)}}class z$ extends N1{constructor($,J,M){super(new Uint32Array($),J,M)}}class m1 extends N1{constructor($,J,M){super(new Float32Array($),J,M)}}var vH=0,t1=new H1,F9=new h1,z8=new A,d1=new $8,Q6=new $8,F1=new A;class o1 extends p5{constructor(){super();this.isBufferGeometry=!0,Object.defineProperty(this,"id",{value:vH++}),this.uuid=N6(),this.name="",this.type="BufferGeometry",this.index=null,this.indirect=null,this.attributes={},this.morphAttributes={},this.morphTargetsRelative=!1,this.groups=[],this.boundingBox=null,this.boundingSphere=null,this.drawRange={start:0,count:1/0},this.userData={}}getIndex(){return this.index}setIndex($){if(Array.isArray($))this.index=new((R7($))?z$:P$)($,1);else this.index=$;return this}setIndirect($){return this.indirect=$,this}getIndirect(){return this.indirect}getAttribute($){return this.attributes[$]}setAttribute($,J){return this.attributes[$]=J,this}deleteAttribute($){return delete this.attributes[$],this}hasAttribute($){return this.attributes[$]!==void 0}addGroup($,J,M=0){this.groups.push({start:$,count:J,materialIndex:M})}clearGroups(){this.groups=[]}setDrawRange($,J){this.drawRange.start=$,this.drawRange.count=J}applyMatrix4($){let J=this.attributes.position;if(J!==void 0)J.applyMatrix4($),J.needsUpdate=!0;let M=this.attributes.normal;if(M!==void 0){let H=new p0().getNormalMatrix($);M.applyNormalMatrix(H),M.needsUpdate=!0}let Q=this.attributes.tangent;if(Q!==void 0)Q.transformDirection($),Q.needsUpdate=!0;if(this.boundingBox!==null)this.computeBoundingBox();if(this.boundingSphere!==null)this.computeBoundingSphere();return this}applyQuaternion($){return t1.makeRotationFromQuaternion($),this.applyMatrix4(t1),this}rotateX($){return t1.makeRotationX($),this.applyMatrix4(t1),this}rotateY($){return t1.makeRotationY($),this.applyMatrix4(t1),this}rotateZ($){return t1.makeRotationZ($),this.applyMatrix4(t1),this}translate($,J,M){return t1.makeTranslation($,J,M),this.applyMatrix4(t1),this}scale($,J,M){return t1.makeScale($,J,M),this.applyMatrix4(t1),this}lookAt($){return F9.lookAt($),F9.updateMatrix(),this.applyMatrix4(F9.matrix),this}center(){return this.computeBoundingBox(),this.boundingBox.getCenter(z8).negate(),this.translate(z8.x,z8.y,z8.z),this}setFromPoints($){let J=this.getAttribute("position");if(J===void 0){let M=[];for(let Q=0,H=$.length;Q<H;Q++){let k=$[Q];M.push(k.x,k.y,k.z||0)}this.setAttribute("position",new m1(M,3))}else{let M=Math.min($.length,J.count);for(let Q=0;Q<M;Q++){let H=$[Q];J.setXYZ(Q,H.x,H.y,H.z||0)}if($.length>J.count)console.warn("THREE.BufferGeometry: Buffer size too small for points data. Use .dispose() and create a new geometry.");J.needsUpdate=!0}return this}computeBoundingBox(){if(this.boundingBox===null)this.boundingBox=new $8;let $=this.attributes.position,J=this.morphAttributes.position;if($&&$.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingBox(): GLBufferAttribute requires a manual bounding box.",this),this.boundingBox.set(new A(-1/0,-1/0,-1/0),new A(1/0,1/0,1/0));return}if($!==void 0){if(this.boundingBox.setFromBufferAttribute($),J)for(let M=0,Q=J.length;M<Q;M++){let H=J[M];if(d1.setFromBufferAttribute(H),this.morphTargetsRelative)F1.addVectors(this.boundingBox.min,d1.min),this.boundingBox.expandByPoint(F1),F1.addVectors(this.boundingBox.max,d1.max),this.boundingBox.expandByPoint(F1);else this.boundingBox.expandByPoint(d1.min),this.boundingBox.expandByPoint(d1.max)}}else this.boundingBox.makeEmpty();if(isNaN(this.boundingBox.min.x)||isNaN(this.boundingBox.min.y)||isNaN(this.boundingBox.min.z))console.error('THREE.BufferGeometry.computeBoundingBox(): Computed min/max have NaN values. The "position" attribute is likely to have NaN values.',this)}computeBoundingSphere(){if(this.boundingSphere===null)this.boundingSphere=new x5;let $=this.attributes.position,J=this.morphAttributes.position;if($&&$.isGLBufferAttribute){console.error("THREE.BufferGeometry.computeBoundingSphere(): GLBufferAttribute requires a manual bounding sphere.",this),this.boundingSphere.set(new A,1/0);return}if($){let M=this.boundingSphere.center;if(d1.setFromBufferAttribute($),J)for(let H=0,k=J.length;H<k;H++){let K=J[H];if(Q6.setFromBufferAttribute(K),this.morphTargetsRelative)F1.addVectors(d1.min,Q6.min),d1.expandByPoint(F1),F1.addVectors(d1.max,Q6.max),d1.expandByPoint(F1);else d1.expandByPoint(Q6.min),d1.expandByPoint(Q6.max)}d1.getCenter(M);let Q=0;for(let H=0,k=$.count;H<k;H++)F1.fromBufferAttribute($,H),Q=Math.max(Q,M.distanceToSquared(F1));if(J)for(let H=0,k=J.length;H<k;H++){let K=J[H],w=this.morphTargetsRelative;for(let W=0,E=K.count;W<E;W++){if(F1.fromBufferAttribute(K,W),w)z8.fromBufferAttribute($,W),F1.add(z8);Q=Math.max(Q,M.distanceToSquared(F1))}}if(this.boundingSphere.radius=Math.sqrt(Q),isNaN(this.boundingSphere.radius))console.error('THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN. The "position" attribute is likely to have NaN values.',this)}}computeTangents(){let $=this.index,J=this.attributes;if($===null||J.position===void 0||J.normal===void 0||J.uv===void 0){console.error("THREE.BufferGeometry: .computeTangents() failed. Missing required attributes (index, position, normal or uv)");return}let{position:M,normal:Q,uv:H}=J;if(this.hasAttribute("tangent")===!1)this.setAttribute("tangent",new N1(new Float32Array(4*M.count),4));let k=this.getAttribute("tangent"),K=[],w=[];for(let S=0;S<M.count;S++)K[S]=new A,w[S]=new A;let W=new A,E=new A,R=new A,Z=new J1,U=new J1,X=new J1,G=new A,q=new A;function Y(S,b,z){W.fromBufferAttribute(M,S),E.fromBufferAttribute(M,b),R.fromBufferAttribute(M,z),Z.fromBufferAttribute(H,S),U.fromBufferAttribute(H,b),X.fromBufferAttribute(H,z),E.sub(W),R.sub(W),U.sub(Z),X.sub(Z);let O=1/(U.x*X.y-X.x*U.y);if(!isFinite(O))return;G.copy(E).multiplyScalar(X.y).addScaledVector(R,-U.y).multiplyScalar(O),q.copy(R).multiplyScalar(U.x).addScaledVector(E,-X.x).multiplyScalar(O),K[S].add(G),K[b].add(G),K[z].add(G),w[S].add(q),w[b].add(q),w[z].add(q)}let N=this.groups;if(N.length===0)N=[{start:0,count:$.count}];for(let S=0,b=N.length;S<b;++S){let z=N[S],O=z.start,f=z.count;for(let g=O,p=O+f;g<p;g+=3)Y($.getX(g+0),$.getX(g+1),$.getX(g+2))}let V=new A,D=new A,P=new A,h=new A;function B(S){P.fromBufferAttribute(Q,S),h.copy(P);let b=K[S];V.copy(b),V.sub(P.multiplyScalar(P.dot(b))).normalize(),D.crossVectors(h,b);let O=D.dot(w[S])<0?-1:1;k.setXYZW(S,V.x,V.y,V.z,O)}for(let S=0,b=N.length;S<b;++S){let z=N[S],O=z.start,f=z.count;for(let g=O,p=O+f;g<p;g+=3)B($.getX(g+0)),B($.getX(g+1)),B($.getX(g+2))}}computeVertexNormals(){let $=this.index,J=this.getAttribute("position");if(J!==void 0){let M=this.getAttribute("normal");if(M===void 0)M=new N1(new Float32Array(J.count*3),3),this.setAttribute("normal",M);else for(let Z=0,U=M.count;Z<U;Z++)M.setXYZ(Z,0,0,0);let Q=new A,H=new A,k=new A,K=new A,w=new A,W=new A,E=new A,R=new A;if($)for(let Z=0,U=$.count;Z<U;Z+=3){let X=$.getX(Z+0),G=$.getX(Z+1),q=$.getX(Z+2);Q.fromBufferAttribute(J,X),H.fromBufferAttribute(J,G),k.fromBufferAttribute(J,q),E.subVectors(k,H),R.subVectors(Q,H),E.cross(R),K.fromBufferAttribute(M,X),w.fromBufferAttribute(M,G),W.fromBufferAttribute(M,q),K.add(E),w.add(E),W.add(E),M.setXYZ(X,K.x,K.y,K.z),M.setXYZ(G,w.x,w.y,w.z),M.setXYZ(q,W.x,W.y,W.z)}else for(let Z=0,U=J.count;Z<U;Z+=3)Q.fromBufferAttribute(J,Z+0),H.fromBufferAttribute(J,Z+1),k.fromBufferAttribute(J,Z+2),E.subVectors(k,H),R.subVectors(Q,H),E.cross(R),M.setXYZ(Z+0,E.x,E.y,E.z),M.setXYZ(Z+1,E.x,E.y,E.z),M.setXYZ(Z+2,E.x,E.y,E.z);this.normalizeNormals(),M.needsUpdate=!0}}normalizeNormals(){let $=this.attributes.normal;for(let J=0,M=$.count;J<M;J++)F1.fromBufferAttribute($,J),F1.normalize(),$.setXYZ(J,F1.x,F1.y,F1.z)}toNonIndexed(){function $(K,w){let{array:W,itemSize:E,normalized:R}=K,Z=new W.constructor(w.length*E),U=0,X=0;for(let G=0,q=w.length;G<q;G++){if(K.isInterleavedBufferAttribute)U=w[G]*K.data.stride+K.offset;else U=w[G]*E;for(let Y=0;Y<E;Y++)Z[X++]=W[U++]}return new N1(Z,E,R)}if(this.index===null)return console.warn("THREE.BufferGeometry.toNonIndexed(): BufferGeometry is already non-indexed."),this;let J=new o1,M=this.index.array,Q=this.attributes;for(let K in Q){let w=Q[K],W=$(w,M);J.setAttribute(K,W)}let H=this.morphAttributes;for(let K in H){let w=[],W=H[K];for(let E=0,R=W.length;E<R;E++){let Z=W[E],U=$(Z,M);w.push(U)}J.morphAttributes[K]=w}J.morphTargetsRelative=this.morphTargetsRelative;let k=this.groups;for(let K=0,w=k.length;K<w;K++){let W=k[K];J.addGroup(W.start,W.count,W.materialIndex)}return J}toJSON(){let $={metadata:{version:4.7,type:"BufferGeometry",generator:"BufferGeometry.toJSON"}};if($.uuid=this.uuid,$.type=this.type,this.name!=="")$.name=this.name;if(Object.keys(this.userData).length>0)$.userData=this.userData;if(this.parameters!==void 0){let w=this.parameters;for(let W in w)if(w[W]!==void 0)$[W]=w[W];return $}$.data={attributes:{}};let J=this.index;if(J!==null)$.data.index={type:J.array.constructor.name,array:Array.prototype.slice.call(J.array)};let M=this.attributes;for(let w in M){let W=M[w];$.data.attributes[w]=W.toJSON($.data)}let Q={},H=!1;for(let w in this.morphAttributes){let W=this.morphAttributes[w],E=[];for(let R=0,Z=W.length;R<Z;R++){let U=W[R];E.push(U.toJSON($.data))}if(E.length>0)Q[w]=E,H=!0}if(H)$.data.morphAttributes=Q,$.data.morphTargetsRelative=this.morphTargetsRelative;let k=this.groups;if(k.length>0)$.data.groups=JSON.parse(JSON.stringify(k));let K=this.boundingSphere;if(K!==null)$.data.boundingSphere=K.toJSON();return $}clone(){return new this.constructor().copy(this)}copy($){this.index=null,this.attributes={},this.morphAttributes={},this.groups=[],this.boundingBox=null,this.boundingSphere=null;let J={};this.name=$.name;let M=$.index;if(M!==null)this.setIndex(M.clone());let Q=$.attributes;for(let W in Q){let E=Q[W];this.setAttribute(W,E.clone(J))}let H=$.morphAttributes;for(let W in H){let E=[],R=H[W];for(let Z=0,U=R.length;Z<U;Z++)E.push(R[Z].clone(J));this.morphAttributes[W]=E}this.morphTargetsRelative=$.morphTargetsRelative;let k=$.groups;for(let W=0,E=k.length;W<E;W++){let R=k[W];this.addGroup(R.start,R.count,R.materialIndex)}let K=$.boundingBox;if(K!==null)this.boundingBox=K.clone();let w=$.boundingSphere;if(w!==null)this.boundingSphere=w.clone();return this.drawRange.start=$.drawRange.start,this.drawRange.count=$.drawRange.count,this.userData=$.userData,this}dispose(){this.dispatchEvent({type:"dispose"})}}var hJ=new H1,o5=new y8,u6=new x5,fJ=new A,c6=new A,n6=new A,s6=new A,L9=new A,o6=new A,yJ=new A,i6=new A;class j1 extends h1{constructor($=new o1,J=new L$){super();this.isMesh=!0,this.type="Mesh",this.geometry=$,this.material=J,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.count=1,this.updateMorphTargets()}copy($,J){if(super.copy($,J),$.morphTargetInfluences!==void 0)this.morphTargetInfluences=$.morphTargetInfluences.slice();if($.morphTargetDictionary!==void 0)this.morphTargetDictionary=Object.assign({},$.morphTargetDictionary);return this.material=Array.isArray($.material)?$.material.slice():$.material,this.geometry=$.geometry,this}updateMorphTargets(){let J=this.geometry.morphAttributes,M=Object.keys(J);if(M.length>0){let Q=J[M[0]];if(Q!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let H=0,k=Q.length;H<k;H++){let K=Q[H].name||String(H);this.morphTargetInfluences.push(0),this.morphTargetDictionary[K]=H}}}}getVertexPosition($,J){let M=this.geometry,Q=M.attributes.position,H=M.morphAttributes.position,k=M.morphTargetsRelative;J.fromBufferAttribute(Q,$);let K=this.morphTargetInfluences;if(H&&K){o6.set(0,0,0);for(let w=0,W=H.length;w<W;w++){let E=K[w],R=H[w];if(E===0)continue;if(L9.fromBufferAttribute(R,$),k)o6.addScaledVector(L9,E);else o6.addScaledVector(L9.sub(J),E)}J.add(o6)}return J}raycast($,J){let M=this.geometry,Q=this.material,H=this.matrixWorld;if(Q===void 0)return;if(M.boundingSphere===null)M.computeBoundingSphere();if(u6.copy(M.boundingSphere),u6.applyMatrix4(H),o5.copy($.ray).recast($.near),u6.containsPoint(o5.origin)===!1){if(o5.intersectSphere(u6,fJ)===null)return;if(o5.origin.distanceToSquared(fJ)>($.far-$.near)**2)return}if(hJ.copy(H).invert(),o5.copy($.ray).applyMatrix4(hJ),M.boundingBox!==null){if(o5.intersectsBox(M.boundingBox)===!1)return}this._computeIntersections($,J,o5)}_computeIntersections($,J,M){let Q,H=this.geometry,k=this.material,K=H.index,w=H.attributes.position,W=H.attributes.uv,E=H.attributes.uv1,R=H.attributes.normal,Z=H.groups,U=H.drawRange;if(K!==null)if(Array.isArray(k))for(let X=0,G=Z.length;X<G;X++){let q=Z[X],Y=k[q.materialIndex],N=Math.max(q.start,U.start),V=Math.min(K.count,Math.min(q.start+q.count,U.start+U.count));for(let D=N,P=V;D<P;D+=3){let h=K.getX(D),B=K.getX(D+1),S=K.getX(D+2);if(Q=r6(this,Y,$,M,W,E,R,h,B,S),Q)Q.faceIndex=Math.floor(D/3),Q.face.materialIndex=q.materialIndex,J.push(Q)}}else{let X=Math.max(0,U.start),G=Math.min(K.count,U.start+U.count);for(let q=X,Y=G;q<Y;q+=3){let N=K.getX(q),V=K.getX(q+1),D=K.getX(q+2);if(Q=r6(this,k,$,M,W,E,R,N,V,D),Q)Q.faceIndex=Math.floor(q/3),J.push(Q)}}else if(w!==void 0)if(Array.isArray(k))for(let X=0,G=Z.length;X<G;X++){let q=Z[X],Y=k[q.materialIndex],N=Math.max(q.start,U.start),V=Math.min(w.count,Math.min(q.start+q.count,U.start+U.count));for(let D=N,P=V;D<P;D+=3){let h=D,B=D+1,S=D+2;if(Q=r6(this,Y,$,M,W,E,R,h,B,S),Q)Q.faceIndex=Math.floor(D/3),Q.face.materialIndex=q.materialIndex,J.push(Q)}}else{let X=Math.max(0,U.start),G=Math.min(w.count,U.start+U.count);for(let q=X,Y=G;q<Y;q+=3){let N=q,V=q+1,D=q+2;if(Q=r6(this,k,$,M,W,E,R,N,V,D),Q)Q.faceIndex=Math.floor(q/3),J.push(Q)}}}}function bH($,J,M,Q,H,k,K,w){let W;if(J.side===1)W=Q.intersectTriangle(K,k,H,!0,w);else W=Q.intersectTriangle(H,k,K,J.side===0,w);if(W===null)return null;i6.copy(w),i6.applyMatrix4($.matrixWorld);let E=M.ray.origin.distanceTo(i6);if(E<M.near||E>M.far)return null;return{distance:E,point:i6.clone(),object:$}}function r6($,J,M,Q,H,k,K,w,W,E){$.getVertexPosition(w,c6),$.getVertexPosition(W,n6),$.getVertexPosition(E,s6);let R=bH($,J,M,Q,c6,n6,s6,yJ);if(R){let Z=new A;if($5.getBarycoord(yJ,c6,n6,s6,Z),H)R.uv=$5.getInterpolatedAttribute(H,w,W,E,Z,new J1);if(k)R.uv1=$5.getInterpolatedAttribute(k,w,W,E,Z,new J1);if(K){if(R.normal=$5.getInterpolatedAttribute(K,w,W,E,Z,new A),R.normal.dot(Q.direction)>0)R.normal.multiplyScalar(-1)}let U={a:w,b:W,c:E,normal:new A,materialIndex:0};$5.getNormal(c6,n6,s6,U.normal),R.face=U,R.barycoord=Z}return R}class j8 extends o1{constructor($=1,J=1,M=1,Q=1,H=1,k=1){super();this.type="BoxGeometry",this.parameters={width:$,height:J,depth:M,widthSegments:Q,heightSegments:H,depthSegments:k};let K=this;Q=Math.floor(Q),H=Math.floor(H),k=Math.floor(k);let w=[],W=[],E=[],R=[],Z=0,U=0;X("z","y","x",-1,-1,M,J,$,k,H,0),X("z","y","x",1,-1,M,J,-$,k,H,1),X("x","z","y",1,1,$,M,J,Q,k,2),X("x","z","y",1,-1,$,M,-J,Q,k,3),X("x","y","z",1,-1,$,J,M,Q,H,4),X("x","y","z",-1,-1,$,J,-M,Q,H,5),this.setIndex(w),this.setAttribute("position",new m1(W,3)),this.setAttribute("normal",new m1(E,3)),this.setAttribute("uv",new m1(R,2));function X(G,q,Y,N,V,D,P,h,B,S,b){let z=D/B,O=P/S,f=D/2,g=P/2,p=h/2,u=B+1,t=S+1,m=0,e=0,d=new A;for(let Q0=0;Q0<t;Q0++){let w0=Q0*O-g;for(let D0=0;D0<u;D0++){let v0=D0*z-f;d[G]=v0*N,d[q]=w0*V,d[Y]=p,W.push(d.x,d.y,d.z),d[G]=0,d[q]=0,d[Y]=h>0?1:-1,E.push(d.x,d.y,d.z),R.push(D0/B),R.push(1-Q0/S),m+=1}}for(let Q0=0;Q0<S;Q0++)for(let w0=0;w0<B;w0++){let D0=Z+w0+u*Q0,v0=Z+w0+u*(Q0+1),l0=Z+(w0+1)+u*(Q0+1),c=Z+(w0+1)+u*Q0;w.push(D0,v0,c),w.push(v0,l0,c),e+=6}K.addGroup(U,e,b),U+=e,Z+=m}}copy($){return super.copy($),this.parameters=Object.assign({},$.parameters),this}static fromJSON($){return new j8($.width,$.height,$.depth,$.widthSegments,$.heightSegments,$.depthSegments)}}function M8($){let J={};for(let M in $){J[M]={};for(let Q in $[M]){let H=$[M][Q];if(H&&(H.isColor||H.isMatrix3||H.isMatrix4||H.isVector2||H.isVector3||H.isVector4||H.isTexture||H.isQuaternion))if(H.isRenderTargetTexture)console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."),J[M][Q]=null;else J[M][Q]=H.clone();else if(Array.isArray(H))J[M][Q]=H.slice();else J[M][Q]=H}}return J}function _1($){let J={};for(let M=0;M<$.length;M++){let Q=M8($[M]);for(let H in Q)J[H]=Q[H]}return J}function pH($){let J=[];for(let M=0;M<$.length;M++)J.push($[M].clone());return J}function X7($){let J=$.getRenderTarget();if(J===null)return $.outputColorSpace;if(J.isXRRenderTarget===!0)return J.texture.colorSpace;return r0.workingColorSpace}var sM={clone:M8,merge:_1},xH=`void main() {
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}`,gH=`void main() {
	gl_FragColor = vec4( 1.0, 0.0, 0.0, 1.0 );
}`;class Q5 extends J8{constructor($){super();if(this.isShaderMaterial=!0,this.type="ShaderMaterial",this.defines={},this.uniforms={},this.uniformsGroups=[],this.vertexShader=xH,this.fragmentShader=gH,this.linewidth=1,this.wireframe=!1,this.wireframeLinewidth=1,this.fog=!1,this.lights=!1,this.clipping=!1,this.forceSinglePass=!0,this.extensions={clipCullDistance:!1,multiDraw:!1},this.defaultAttributeValues={color:[1,1,1],uv:[0,0],uv1:[0,0]},this.index0AttributeName=void 0,this.uniformsNeedUpdate=!1,this.glslVersion=null,$!==void 0)this.setValues($)}copy($){return super.copy($),this.fragmentShader=$.fragmentShader,this.vertexShader=$.vertexShader,this.uniforms=M8($.uniforms),this.uniformsGroups=pH($.uniformsGroups),this.defines=Object.assign({},$.defines),this.wireframe=$.wireframe,this.wireframeLinewidth=$.wireframeLinewidth,this.fog=$.fog,this.lights=$.lights,this.clipping=$.clipping,this.extensions=Object.assign({},$.extensions),this.glslVersion=$.glslVersion,this}toJSON($){let J=super.toJSON($);J.glslVersion=this.glslVersion,J.uniforms={};for(let Q in this.uniforms){let k=this.uniforms[Q].value;if(k&&k.isTexture)J.uniforms[Q]={type:"t",value:k.toJSON($).uuid};else if(k&&k.isColor)J.uniforms[Q]={type:"c",value:k.getHex()};else if(k&&k.isVector2)J.uniforms[Q]={type:"v2",value:k.toArray()};else if(k&&k.isVector3)J.uniforms[Q]={type:"v3",value:k.toArray()};else if(k&&k.isVector4)J.uniforms[Q]={type:"v4",value:k.toArray()};else if(k&&k.isMatrix3)J.uniforms[Q]={type:"m3",value:k.toArray()};else if(k&&k.isMatrix4)J.uniforms[Q]={type:"m4",value:k.toArray()};else J.uniforms[Q]={value:k}}if(Object.keys(this.defines).length>0)J.defines=this.defines;J.vertexShader=this.vertexShader,J.fragmentShader=this.fragmentShader,J.lights=this.lights,J.clipping=this.clipping;let M={};for(let Q in this.extensions)if(this.extensions[Q]===!0)M[Q]=!0;if(Object.keys(M).length>0)J.extensions=M;return J}}class V$ extends h1{constructor(){super();this.isCamera=!0,this.type="Camera",this.matrixWorldInverse=new H1,this.projectionMatrix=new H1,this.projectionMatrixInverse=new H1,this.coordinateSystem=2000,this._reversedDepth=!1}get reversedDepth(){return this._reversedDepth}copy($,J){return super.copy($,J),this.matrixWorldInverse.copy($.matrixWorldInverse),this.projectionMatrix.copy($.projectionMatrix),this.projectionMatrixInverse.copy($.projectionMatrixInverse),this.coordinateSystem=$.coordinateSystem,this}getWorldDirection($){return super.getWorldDirection($).negate()}updateMatrixWorld($){super.updateMatrixWorld($),this.matrixWorldInverse.copy(this.matrixWorld).invert()}updateWorldMatrix($,J){super.updateWorldMatrix($,J),this.matrixWorldInverse.copy(this.matrixWorld).invert()}clone(){return new this.constructor().copy(this)}}var j5=new A,jJ=new J1,vJ=new J1;class L1 extends V${constructor($=50,J=1,M=0.1,Q=2000){super();this.isPerspectiveCamera=!0,this.type="PerspectiveCamera",this.fov=$,this.zoom=1,this.near=M,this.far=Q,this.focus=10,this.aspect=J,this.view=null,this.filmGauge=35,this.filmOffset=0,this.updateProjectionMatrix()}copy($,J){return super.copy($,J),this.fov=$.fov,this.zoom=$.zoom,this.near=$.near,this.far=$.far,this.focus=$.focus,this.aspect=$.aspect,this.view=$.view===null?null:Object.assign({},$.view),this.filmGauge=$.filmGauge,this.filmOffset=$.filmOffset,this}setFocalLength($){let J=0.5*this.getFilmHeight()/$;this.fov=J$*2*Math.atan(J),this.updateProjectionMatrix()}getFocalLength(){let $=Math.tan($9*0.5*this.fov);return 0.5*this.getFilmHeight()/$}getEffectiveFOV(){return J$*2*Math.atan(Math.tan($9*0.5*this.fov)/this.zoom)}getFilmWidth(){return this.filmGauge*Math.min(this.aspect,1)}getFilmHeight(){return this.filmGauge/Math.max(this.aspect,1)}getViewBounds($,J,M){j5.set(-1,-1,0.5).applyMatrix4(this.projectionMatrixInverse),J.set(j5.x,j5.y).multiplyScalar(-$/j5.z),j5.set(1,1,0.5).applyMatrix4(this.projectionMatrixInverse),M.set(j5.x,j5.y).multiplyScalar(-$/j5.z)}getViewSize($,J){return this.getViewBounds($,jJ,vJ),J.subVectors(vJ,jJ)}setViewOffset($,J,M,Q,H,k){if(this.aspect=$/J,this.view===null)this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1};this.view.enabled=!0,this.view.fullWidth=$,this.view.fullHeight=J,this.view.offsetX=M,this.view.offsetY=Q,this.view.width=H,this.view.height=k,this.updateProjectionMatrix()}clearViewOffset(){if(this.view!==null)this.view.enabled=!1;this.updateProjectionMatrix()}updateProjectionMatrix(){let $=this.near,J=$*Math.tan($9*0.5*this.fov)/this.zoom,M=2*J,Q=this.aspect*M,H=-0.5*Q,k=this.view;if(this.view!==null&&this.view.enabled){let{fullWidth:w,fullHeight:W}=k;H+=k.offsetX*Q/w,J-=k.offsetY*M/W,Q*=k.width/w,M*=k.height/W}let K=this.filmOffset;if(K!==0)H+=$*K/this.getFilmWidth();this.projectionMatrix.makePerspective(H,H+Q,J,J-M,$,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON($){let J=super.toJSON($);if(J.object.fov=this.fov,J.object.zoom=this.zoom,J.object.near=this.near,J.object.far=this.far,J.object.focus=this.focus,J.object.aspect=this.aspect,this.view!==null)J.object.view=Object.assign({},this.view);return J.object.filmGauge=this.filmGauge,J.object.filmOffset=this.filmOffset,J}}var V8=-90,B8=1;class G7 extends h1{constructor($,J,M){super();this.type="CubeCamera",this.renderTarget=M,this.coordinateSystem=null,this.activeMipmapLevel=0;let Q=new L1(V8,B8,$,J);Q.layers=this.layers,this.add(Q);let H=new L1(V8,B8,$,J);H.layers=this.layers,this.add(H);let k=new L1(V8,B8,$,J);k.layers=this.layers,this.add(k);let K=new L1(V8,B8,$,J);K.layers=this.layers,this.add(K);let w=new L1(V8,B8,$,J);w.layers=this.layers,this.add(w);let W=new L1(V8,B8,$,J);W.layers=this.layers,this.add(W)}updateCoordinateSystem(){let $=this.coordinateSystem,J=this.children.concat(),[M,Q,H,k,K,w]=J;for(let W of J)this.remove(W);if($===2000)M.up.set(0,1,0),M.lookAt(1,0,0),Q.up.set(0,1,0),Q.lookAt(-1,0,0),H.up.set(0,0,-1),H.lookAt(0,1,0),k.up.set(0,0,1),k.lookAt(0,-1,0),K.up.set(0,1,0),K.lookAt(0,0,1),w.up.set(0,1,0),w.lookAt(0,0,-1);else if($===2001)M.up.set(0,-1,0),M.lookAt(-1,0,0),Q.up.set(0,-1,0),Q.lookAt(1,0,0),H.up.set(0,0,1),H.lookAt(0,1,0),k.up.set(0,0,-1),k.lookAt(0,-1,0),K.up.set(0,-1,0),K.lookAt(0,0,1),w.up.set(0,-1,0),w.lookAt(0,0,-1);else throw Error("THREE.CubeCamera.updateCoordinateSystem(): Invalid coordinate system: "+$);for(let W of J)this.add(W),W.updateMatrixWorld()}update($,J){if(this.parent===null)this.updateMatrixWorld();let{renderTarget:M,activeMipmapLevel:Q}=this;if(this.coordinateSystem!==$.coordinateSystem)this.coordinateSystem=$.coordinateSystem,this.updateCoordinateSystem();let[H,k,K,w,W,E]=this.children,R=$.getRenderTarget(),Z=$.getActiveCubeFace(),U=$.getActiveMipmapLevel(),X=$.xr.enabled;$.xr.enabled=!1;let G=M.texture.generateMipmaps;M.texture.generateMipmaps=!1,$.setRenderTarget(M,0,Q),$.render(J,H),$.setRenderTarget(M,1,Q),$.render(J,k),$.setRenderTarget(M,2,Q),$.render(J,K),$.setRenderTarget(M,3,Q),$.render(J,w),$.setRenderTarget(M,4,Q),$.render(J,W),M.texture.generateMipmaps=G,$.setRenderTarget(M,5,Q),$.render(J,E),$.setRenderTarget(R,Z,U),$.xr.enabled=X,M.texture.needsPMREMUpdate=!0}}class B$ extends T1{constructor($=[],J=301,M,Q,H,k,K,w,W,E){super($,J,M,Q,H,k,K,w,W,E);this.isCubeTexture=!0,this.flipY=!1}get images(){return this.image}set images($){this.image=$}}class D7 extends M5{constructor($=1,J={}){super($,$,J);this.isWebGLCubeRenderTarget=!0;let M={width:$,height:$,depth:1},Q=[M,M,M,M,M,M];this.texture=new B$(Q),this._setTextureOptions(J),this.texture.isRenderTargetTexture=!0}fromEquirectangularTexture($,J){this.texture.type=J.type,this.texture.colorSpace=J.colorSpace,this.texture.generateMipmaps=J.generateMipmaps,this.texture.minFilter=J.minFilter,this.texture.magFilter=J.magFilter;let M={uniforms:{tEquirect:{value:null}},vertexShader:`

				varying vec3 vWorldDirection;

				vec3 transformDirection( in vec3 dir, in mat4 matrix ) {

					return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );

				}

				void main() {

					vWorldDirection = transformDirection( position, modelMatrix );

					#include <begin_vertex>
					#include <project_vertex>

				}
			`,fragmentShader:`

				uniform sampler2D tEquirect;

				varying vec3 vWorldDirection;

				#include <common>

				void main() {

					vec3 direction = normalize( vWorldDirection );

					vec2 sampleUV = equirectUv( direction );

					gl_FragColor = texture2D( tEquirect, sampleUV );

				}
			`},Q=new j8(5,5,5),H=new Q5({name:"CubemapFromEquirect",uniforms:M8(M.uniforms),vertexShader:M.vertexShader,fragmentShader:M.fragmentShader,side:1,blending:0});H.uniforms.tEquirect.value=J;let k=new j1(Q,H),K=J.minFilter;if(J.minFilter===1008)J.minFilter=1006;return new G7(1,10,this).update($,k),J.minFilter=K,k.geometry.dispose(),k.material.dispose(),this}clear($,J=!0,M=!0,Q=!0){let H=$.getRenderTarget();for(let k=0;k<6;k++)$.setRenderTarget(this,k),$.clear(J,M,Q);$.setRenderTarget(H)}}class I8 extends h1{constructor(){super();this.isGroup=!0,this.type="Group"}}var lH={type:"move"};class G6{constructor(){this._targetRay=null,this._grip=null,this._hand=null}getHandSpace(){if(this._hand===null)this._hand=new I8,this._hand.matrixAutoUpdate=!1,this._hand.visible=!1,this._hand.joints={},this._hand.inputState={pinching:!1};return this._hand}getTargetRaySpace(){if(this._targetRay===null)this._targetRay=new I8,this._targetRay.matrixAutoUpdate=!1,this._targetRay.visible=!1,this._targetRay.hasLinearVelocity=!1,this._targetRay.linearVelocity=new A,this._targetRay.hasAngularVelocity=!1,this._targetRay.angularVelocity=new A;return this._targetRay}getGripSpace(){if(this._grip===null)this._grip=new I8,this._grip.matrixAutoUpdate=!1,this._grip.visible=!1,this._grip.hasLinearVelocity=!1,this._grip.linearVelocity=new A,this._grip.hasAngularVelocity=!1,this._grip.angularVelocity=new A;return this._grip}dispatchEvent($){if(this._targetRay!==null)this._targetRay.dispatchEvent($);if(this._grip!==null)this._grip.dispatchEvent($);if(this._hand!==null)this._hand.dispatchEvent($);return this}connect($){if($&&$.hand){let J=this._hand;if(J)for(let M of $.hand.values())this._getHandJoint(J,M)}return this.dispatchEvent({type:"connected",data:$}),this}disconnect($){if(this.dispatchEvent({type:"disconnected",data:$}),this._targetRay!==null)this._targetRay.visible=!1;if(this._grip!==null)this._grip.visible=!1;if(this._hand!==null)this._hand.visible=!1;return this}update($,J,M){let Q=null,H=null,k=null,K=this._targetRay,w=this._grip,W=this._hand;if($&&J.session.visibilityState!=="visible-blurred"){if(W&&$.hand){k=!0;for(let G of $.hand.values()){let q=J.getJointPose(G,M),Y=this._getHandJoint(W,G);if(q!==null)Y.matrix.fromArray(q.transform.matrix),Y.matrix.decompose(Y.position,Y.rotation,Y.scale),Y.matrixWorldNeedsUpdate=!0,Y.jointRadius=q.radius;Y.visible=q!==null}let E=W.joints["index-finger-tip"],R=W.joints["thumb-tip"],Z=E.position.distanceTo(R.position),U=0.02,X=0.005;if(W.inputState.pinching&&Z>U+X)W.inputState.pinching=!1,this.dispatchEvent({type:"pinchend",handedness:$.handedness,target:this});else if(!W.inputState.pinching&&Z<=U-X)W.inputState.pinching=!0,this.dispatchEvent({type:"pinchstart",handedness:$.handedness,target:this})}else if(w!==null&&$.gripSpace){if(H=J.getPose($.gripSpace,M),H!==null){if(w.matrix.fromArray(H.transform.matrix),w.matrix.decompose(w.position,w.rotation,w.scale),w.matrixWorldNeedsUpdate=!0,H.linearVelocity)w.hasLinearVelocity=!0,w.linearVelocity.copy(H.linearVelocity);else w.hasLinearVelocity=!1;if(H.angularVelocity)w.hasAngularVelocity=!0,w.angularVelocity.copy(H.angularVelocity);else w.hasAngularVelocity=!1}}if(K!==null){if(Q=J.getPose($.targetRaySpace,M),Q===null&&H!==null)Q=H;if(Q!==null){if(K.matrix.fromArray(Q.transform.matrix),K.matrix.decompose(K.position,K.rotation,K.scale),K.matrixWorldNeedsUpdate=!0,Q.linearVelocity)K.hasLinearVelocity=!0,K.linearVelocity.copy(Q.linearVelocity);else K.hasLinearVelocity=!1;if(Q.angularVelocity)K.hasAngularVelocity=!0,K.angularVelocity.copy(Q.angularVelocity);else K.hasAngularVelocity=!1;this.dispatchEvent(lH)}}}if(K!==null)K.visible=Q!==null;if(w!==null)w.visible=H!==null;if(W!==null)W.visible=k!==null;return this}_getHandJoint($,J){if($.joints[J.jointName]===void 0){let M=new I8;M.matrixAutoUpdate=!1,M.visible=!1,$.joints[J.jointName]=M,$.add(M)}return $.joints[J.jointName]}}class I$ extends h1{constructor(){super();if(this.isScene=!0,this.type="Scene",this.background=null,this.environment=null,this.fog=null,this.backgroundBlurriness=0,this.backgroundIntensity=1,this.backgroundRotation=new u1,this.environmentIntensity=1,this.environmentRotation=new u1,this.overrideMaterial=null,typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}copy($,J){if(super.copy($,J),$.background!==null)this.background=$.background.clone();if($.environment!==null)this.environment=$.environment.clone();if($.fog!==null)this.fog=$.fog.clone();if(this.backgroundBlurriness=$.backgroundBlurriness,this.backgroundIntensity=$.backgroundIntensity,this.backgroundRotation.copy($.backgroundRotation),this.environmentIntensity=$.environmentIntensity,this.environmentRotation.copy($.environmentRotation),$.overrideMaterial!==null)this.overrideMaterial=$.overrideMaterial.clone();return this.matrixAutoUpdate=$.matrixAutoUpdate,this}toJSON($){let J=super.toJSON($);if(this.fog!==null)J.object.fog=this.fog.toJSON();if(this.backgroundBlurriness>0)J.object.backgroundBlurriness=this.backgroundBlurriness;if(this.backgroundIntensity!==1)J.object.backgroundIntensity=this.backgroundIntensity;if(J.object.backgroundRotation=this.backgroundRotation.toArray(),this.environmentIntensity!==1)J.object.environmentIntensity=this.environmentIntensity;return J.object.environmentRotation=this.environmentRotation.toArray(),J}}var P9=new A,dH=new A,mH=new p0;class e1{constructor($=new A(1,0,0),J=0){this.isPlane=!0,this.normal=$,this.constant=J}set($,J){return this.normal.copy($),this.constant=J,this}setComponents($,J,M,Q){return this.normal.set($,J,M),this.constant=Q,this}setFromNormalAndCoplanarPoint($,J){return this.normal.copy($),this.constant=-J.dot(this.normal),this}setFromCoplanarPoints($,J,M){let Q=P9.subVectors(M,J).cross(dH.subVectors($,J)).normalize();return this.setFromNormalAndCoplanarPoint(Q,$),this}copy($){return this.normal.copy($.normal),this.constant=$.constant,this}normalize(){let $=1/this.normal.length();return this.normal.multiplyScalar($),this.constant*=$,this}negate(){return this.constant*=-1,this.normal.negate(),this}distanceToPoint($){return this.normal.dot($)+this.constant}distanceToSphere($){return this.distanceToPoint($.center)-$.radius}projectPoint($,J){return J.copy($).addScaledVector(this.normal,-this.distanceToPoint($))}intersectLine($,J){let M=$.delta(P9),Q=this.normal.dot(M);if(Q===0){if(this.distanceToPoint($.start)===0)return J.copy($.start);return null}let H=-($.start.dot(this.normal)+this.constant)/Q;if(H<0||H>1)return null;return J.copy($.start).addScaledVector(M,H)}intersectsLine($){let J=this.distanceToPoint($.start),M=this.distanceToPoint($.end);return J<0&&M>0||M<0&&J>0}intersectsBox($){return $.intersectsPlane(this)}intersectsSphere($){return $.intersectsPlane(this)}coplanarPoint($){return $.copy(this.normal).multiplyScalar(-this.constant)}applyMatrix4($,J){let M=J||mH.getNormalMatrix($),Q=this.coplanarPoint(P9).applyMatrix4($),H=this.normal.applyMatrix3(M).normalize();return this.constant=-Q.dot(H),this}translate($){return this.constant-=$.dot(this.normal),this}equals($){return $.normal.equals(this.normal)&&$.constant===this.constant}clone(){return new this.constructor().copy(this)}}var i5=new x5,uH=new J1(0.5,0.5),a6=new A;class C${constructor($=new e1,J=new e1,M=new e1,Q=new e1,H=new e1,k=new e1){this.planes=[$,J,M,Q,H,k]}set($,J,M,Q,H,k){let K=this.planes;return K[0].copy($),K[1].copy(J),K[2].copy(M),K[3].copy(Q),K[4].copy(H),K[5].copy(k),this}copy($){let J=this.planes;for(let M=0;M<6;M++)J[M].copy($.planes[M]);return this}setFromProjectionMatrix($,J=2000,M=!1){let Q=this.planes,H=$.elements,k=H[0],K=H[1],w=H[2],W=H[3],E=H[4],R=H[5],Z=H[6],U=H[7],X=H[8],G=H[9],q=H[10],Y=H[11],N=H[12],V=H[13],D=H[14],P=H[15];if(Q[0].setComponents(W-k,U-E,Y-X,P-N).normalize(),Q[1].setComponents(W+k,U+E,Y+X,P+N).normalize(),Q[2].setComponents(W+K,U+R,Y+G,P+V).normalize(),Q[3].setComponents(W-K,U-R,Y-G,P-V).normalize(),M)Q[4].setComponents(w,Z,q,D).normalize(),Q[5].setComponents(W-w,U-Z,Y-q,P-D).normalize();else if(Q[4].setComponents(W-w,U-Z,Y-q,P-D).normalize(),J===2000)Q[5].setComponents(W+w,U+Z,Y+q,P+D).normalize();else if(J===2001)Q[5].setComponents(w,Z,q,D).normalize();else throw Error("THREE.Frustum.setFromProjectionMatrix(): Invalid coordinate system: "+J);return this}intersectsObject($){if($.boundingSphere!==void 0){if($.boundingSphere===null)$.computeBoundingSphere();i5.copy($.boundingSphere).applyMatrix4($.matrixWorld)}else{let J=$.geometry;if(J.boundingSphere===null)J.computeBoundingSphere();i5.copy(J.boundingSphere).applyMatrix4($.matrixWorld)}return this.intersectsSphere(i5)}intersectsSprite($){i5.center.set(0,0,0);let J=uH.distanceTo($.center);return i5.radius=0.7071067811865476+J,i5.applyMatrix4($.matrixWorld),this.intersectsSphere(i5)}intersectsSphere($){let J=this.planes,M=$.center,Q=-$.radius;for(let H=0;H<6;H++)if(J[H].distanceToPoint(M)<Q)return!1;return!0}intersectsBox($){let J=this.planes;for(let M=0;M<6;M++){let Q=J[M];if(a6.x=Q.normal.x>0?$.max.x:$.min.x,a6.y=Q.normal.y>0?$.max.y:$.min.y,a6.z=Q.normal.z>0?$.max.z:$.min.z,Q.distanceToPoint(a6)<0)return!1}return!0}containsPoint($){let J=this.planes;for(let M=0;M<6;M++)if(J[M].distanceToPoint($)<0)return!1;return!0}clone(){return new this.constructor().copy(this)}}class D6 extends J8{constructor($){super();this.isLineBasicMaterial=!0,this.type="LineBasicMaterial",this.color=new e0(16777215),this.map=null,this.linewidth=1,this.linecap="round",this.linejoin="round",this.fog=!0,this.setValues($)}copy($){return super.copy($),this.color.copy($.color),this.map=$.map,this.linewidth=$.linewidth,this.linecap=$.linecap,this.linejoin=$.linejoin,this.fog=$.fog,this}}var M$=new A,Q$=new A,bJ=new H1,H6=new y8,t6=new x5,z9=new A,pJ=new A;class q7 extends h1{constructor($=new o1,J=new D6){super();this.isLine=!0,this.type="Line",this.geometry=$,this.material=J,this.morphTargetDictionary=void 0,this.morphTargetInfluences=void 0,this.updateMorphTargets()}copy($,J){return super.copy($,J),this.material=Array.isArray($.material)?$.material.slice():$.material,this.geometry=$.geometry,this}computeLineDistances(){let $=this.geometry;if($.index===null){let J=$.attributes.position,M=[0];for(let Q=1,H=J.count;Q<H;Q++)M$.fromBufferAttribute(J,Q-1),Q$.fromBufferAttribute(J,Q),M[Q]=M[Q-1],M[Q]+=M$.distanceTo(Q$);$.setAttribute("lineDistance",new m1(M,1))}else console.warn("THREE.Line.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}raycast($,J){let M=this.geometry,Q=this.matrixWorld,H=$.params.Line.threshold,k=M.drawRange;if(M.boundingSphere===null)M.computeBoundingSphere();if(t6.copy(M.boundingSphere),t6.applyMatrix4(Q),t6.radius+=H,$.ray.intersectsSphere(t6)===!1)return;bJ.copy(Q).invert(),H6.copy($.ray).applyMatrix4(bJ);let K=H/((this.scale.x+this.scale.y+this.scale.z)/3),w=K*K,W=this.isLineSegments?2:1,E=M.index,Z=M.attributes.position;if(E!==null){let U=Math.max(0,k.start),X=Math.min(E.count,k.start+k.count);for(let G=U,q=X-1;G<q;G+=W){let Y=E.getX(G),N=E.getX(G+1),V=e6(this,$,H6,w,Y,N,G);if(V)J.push(V)}if(this.isLineLoop){let G=E.getX(X-1),q=E.getX(U),Y=e6(this,$,H6,w,G,q,X-1);if(Y)J.push(Y)}}else{let U=Math.max(0,k.start),X=Math.min(Z.count,k.start+k.count);for(let G=U,q=X-1;G<q;G+=W){let Y=e6(this,$,H6,w,G,G+1,G);if(Y)J.push(Y)}if(this.isLineLoop){let G=e6(this,$,H6,w,X-1,U,X-1);if(G)J.push(G)}}}updateMorphTargets(){let J=this.geometry.morphAttributes,M=Object.keys(J);if(M.length>0){let Q=J[M[0]];if(Q!==void 0){this.morphTargetInfluences=[],this.morphTargetDictionary={};for(let H=0,k=Q.length;H<k;H++){let K=Q[H].name||String(H);this.morphTargetInfluences.push(0),this.morphTargetDictionary[K]=H}}}}}function e6($,J,M,Q,H,k,K){let w=$.geometry.attributes.position;if(M$.fromBufferAttribute(w,H),Q$.fromBufferAttribute(w,k),M.distanceSqToSegment(M$,Q$,z9,pJ)>Q)return;z9.applyMatrix4($.matrixWorld);let E=J.ray.origin.distanceTo(z9);if(E<J.near||E>J.far)return;return{distance:E,point:pJ.clone().applyMatrix4($.matrixWorld),index:K,face:null,faceIndex:null,barycoord:null,object:$}}var xJ=new A,gJ=new A;class _$ extends q7{constructor($,J){super($,J);this.isLineSegments=!0,this.type="LineSegments"}computeLineDistances(){let $=this.geometry;if($.index===null){let J=$.attributes.position,M=[];for(let Q=0,H=J.count;Q<H;Q+=2)xJ.fromBufferAttribute(J,Q),gJ.fromBufferAttribute(J,Q+1),M[Q]=Q===0?0:M[Q-1],M[Q+1]=M[Q]+xJ.distanceTo(gJ);$.setAttribute("lineDistance",new m1(M,1))}else console.warn("THREE.LineSegments.computeLineDistances(): Computation only possible with non-indexed BufferGeometry.");return this}}class v8 extends T1{constructor($,J,M=1014,Q,H,k,K=1003,w=1003,W,E=1026,R=1){if(E!==1026&&E!==1027)throw Error("DepthTexture format must be either THREE.DepthFormat or THREE.DepthStencilFormat");let Z={width:$,height:J,depth:R};super(Z,Q,H,k,K,w,E,M,W);this.isDepthTexture=!0,this.flipY=!1,this.generateMipmaps=!1,this.compareFunction=null}copy($){return super.copy($),this.source=new X6(Object.assign({},$.image)),this.compareFunction=$.compareFunction,this}toJSON($){let J=super.toJSON($);if(this.compareFunction!==null)J.compareFunction=this.compareFunction;return J}}class q6 extends o1{constructor($=1,J=1,M=1,Q=1){super();this.type="PlaneGeometry",this.parameters={width:$,height:J,widthSegments:M,heightSegments:Q};let H=$/2,k=J/2,K=Math.floor(M),w=Math.floor(Q),W=K+1,E=w+1,R=$/K,Z=J/w,U=[],X=[],G=[],q=[];for(let Y=0;Y<E;Y++){let N=Y*Z-k;for(let V=0;V<W;V++){let D=V*R-H;X.push(D,-N,0),G.push(0,0,1),q.push(V/K),q.push(1-Y/w)}}for(let Y=0;Y<w;Y++)for(let N=0;N<K;N++){let V=N+W*Y,D=N+W*(Y+1),P=N+1+W*(Y+1),h=N+1+W*Y;U.push(V,D,h),U.push(D,P,h)}this.setIndex(U),this.setAttribute("position",new m1(X,3)),this.setAttribute("normal",new m1(G,3)),this.setAttribute("uv",new m1(q,2))}copy($){return super.copy($),this.parameters=Object.assign({},$.parameters),this}static fromJSON($){return new q6($.width,$.height,$.widthSegments,$.heightSegments)}}class O7 extends J8{constructor($){super();this.isMeshDepthMaterial=!0,this.type="MeshDepthMaterial",this.depthPacking=3200,this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.wireframe=!1,this.wireframeLinewidth=1,this.setValues($)}copy($){return super.copy($),this.depthPacking=$.depthPacking,this.map=$.map,this.alphaMap=$.alphaMap,this.displacementMap=$.displacementMap,this.displacementScale=$.displacementScale,this.displacementBias=$.displacementBias,this.wireframe=$.wireframe,this.wireframeLinewidth=$.wireframeLinewidth,this}}class F7 extends J8{constructor($){super();this.isMeshDistanceMaterial=!0,this.type="MeshDistanceMaterial",this.map=null,this.alphaMap=null,this.displacementMap=null,this.displacementScale=1,this.displacementBias=0,this.setValues($)}copy($){return super.copy($),this.map=$.map,this.alphaMap=$.alphaMap,this.displacementMap=$.displacementMap,this.displacementScale=$.displacementScale,this.displacementBias=$.displacementBias,this}}function $$($,J){if(!$||$.constructor===J)return $;if(typeof J.BYTES_PER_ELEMENT==="number")return new J($);return Array.prototype.slice.call($)}function cH($){return ArrayBuffer.isView($)&&!($ instanceof DataView)}class b8{constructor($,J,M,Q){this.parameterPositions=$,this._cachedIndex=0,this.resultBuffer=Q!==void 0?Q:new J.constructor(M),this.sampleValues=J,this.valueSize=M,this.settings=null,this.DefaultSettings_={}}evaluate($){let J=this.parameterPositions,M=this._cachedIndex,Q=J[M],H=J[M-1];M:{$:{let k;J:{Q:if(!($<Q)){for(let K=M+2;;){if(Q===void 0){if($<H)break Q;return M=J.length,this._cachedIndex=M,this.copySampleValue_(M-1)}if(M===K)break;if(H=Q,Q=J[++M],$<Q)break $}k=J.length;break J}if(!($>=H)){let K=J[1];if($<K)M=2,H=K;for(let w=M-2;;){if(H===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(M===w)break;if(Q=H,H=J[--M-1],$>=H)break $}k=M,M=0;break J}break M}while(M<k){let K=M+k>>>1;if($<J[K])k=K;else M=K+1}if(Q=J[M],H=J[M-1],H===void 0)return this._cachedIndex=0,this.copySampleValue_(0);if(Q===void 0)return M=J.length,this._cachedIndex=M,this.copySampleValue_(M-1)}this._cachedIndex=M,this.intervalChanged_(M,H,Q)}return this.interpolate_(M,H,$,Q)}getSettings_(){return this.settings||this.DefaultSettings_}copySampleValue_($){let J=this.resultBuffer,M=this.sampleValues,Q=this.valueSize,H=$*Q;for(let k=0;k!==Q;++k)J[k]=M[H+k];return J}interpolate_(){throw Error("call to abstract method")}intervalChanged_(){}}class L7 extends b8{constructor($,J,M,Q){super($,J,M,Q);this._weightPrev=-0,this._offsetPrev=-0,this._weightNext=-0,this._offsetNext=-0,this.DefaultSettings_={endingStart:2400,endingEnd:2400}}intervalChanged_($,J,M){let Q=this.parameterPositions,H=$-2,k=$+1,K=Q[H],w=Q[k];if(K===void 0)switch(this.getSettings_().endingStart){case 2401:H=$,K=2*J-M;break;case 2402:H=Q.length-2,K=J+Q[H]-Q[H+1];break;default:H=$,K=M}if(w===void 0)switch(this.getSettings_().endingEnd){case 2401:k=$,w=2*M-J;break;case 2402:k=1,w=M+Q[1]-Q[0];break;default:k=$-1,w=J}let W=(M-J)*0.5,E=this.valueSize;this._weightPrev=W/(J-K),this._weightNext=W/(w-M),this._offsetPrev=H*E,this._offsetNext=k*E}interpolate_($,J,M,Q){let H=this.resultBuffer,k=this.sampleValues,K=this.valueSize,w=$*K,W=w-K,E=this._offsetPrev,R=this._offsetNext,Z=this._weightPrev,U=this._weightNext,X=(M-J)/(Q-J),G=X*X,q=G*X,Y=-Z*q+2*Z*G-Z*X,N=(1+Z)*q+(-1.5-2*Z)*G+(-0.5+Z)*X+1,V=(-1-U)*q+(1.5+U)*G+0.5*X,D=U*q-U*G;for(let P=0;P!==K;++P)H[P]=Y*k[E+P]+N*k[W+P]+V*k[w+P]+D*k[R+P];return H}}class P7 extends b8{constructor($,J,M,Q){super($,J,M,Q)}interpolate_($,J,M,Q){let H=this.resultBuffer,k=this.sampleValues,K=this.valueSize,w=$*K,W=w-K,E=(M-J)/(Q-J),R=1-E;for(let Z=0;Z!==K;++Z)H[Z]=k[W+Z]*R+k[w+Z]*E;return H}}class z7 extends b8{constructor($,J,M,Q){super($,J,M,Q)}interpolate_($){return this.copySampleValue_($-1)}}class H5{constructor($,J,M,Q){if($===void 0)throw Error("THREE.KeyframeTrack: track name is undefined");if(J===void 0||J.length===0)throw Error("THREE.KeyframeTrack: no keyframes in track named "+$);this.name=$,this.times=$$(J,this.TimeBufferType),this.values=$$(M,this.ValueBufferType),this.setInterpolation(Q||this.DefaultInterpolation)}static toJSON($){let J=$.constructor,M;if(J.toJSON!==this.toJSON)M=J.toJSON($);else{M={name:$.name,times:$$($.times,Array),values:$$($.values,Array)};let Q=$.getInterpolation();if(Q!==$.DefaultInterpolation)M.interpolation=Q}return M.type=$.ValueTypeName,M}InterpolantFactoryMethodDiscrete($){return new z7(this.times,this.values,this.getValueSize(),$)}InterpolantFactoryMethodLinear($){return new P7(this.times,this.values,this.getValueSize(),$)}InterpolantFactoryMethodSmooth($){return new L7(this.times,this.values,this.getValueSize(),$)}setInterpolation($){let J;switch($){case 2300:J=this.InterpolantFactoryMethodDiscrete;break;case 2301:J=this.InterpolantFactoryMethodLinear;break;case 2302:J=this.InterpolantFactoryMethodSmooth;break}if(J===void 0){let M="unsupported interpolation for "+this.ValueTypeName+" keyframe track named "+this.name;if(this.createInterpolant===void 0)if($!==this.DefaultInterpolation)this.setInterpolation(this.DefaultInterpolation);else throw Error(M);return console.warn("THREE.KeyframeTrack:",M),this}return this.createInterpolant=J,this}getInterpolation(){switch(this.createInterpolant){case this.InterpolantFactoryMethodDiscrete:return 2300;case this.InterpolantFactoryMethodLinear:return 2301;case this.InterpolantFactoryMethodSmooth:return 2302}}getValueSize(){return this.values.length/this.times.length}shift($){if($!==0){let J=this.times;for(let M=0,Q=J.length;M!==Q;++M)J[M]+=$}return this}scale($){if($!==1){let J=this.times;for(let M=0,Q=J.length;M!==Q;++M)J[M]*=$}return this}trim($,J){let M=this.times,Q=M.length,H=0,k=Q-1;while(H!==Q&&M[H]<$)++H;while(k!==-1&&M[k]>J)--k;if(++k,H!==0||k!==Q){if(H>=k)k=Math.max(k,1),H=k-1;let K=this.getValueSize();this.times=M.slice(H,k),this.values=this.values.slice(H*K,k*K)}return this}validate(){let $=!0,J=this.getValueSize();if(J-Math.floor(J)!==0)console.error("THREE.KeyframeTrack: Invalid value size in track.",this),$=!1;let M=this.times,Q=this.values,H=M.length;if(H===0)console.error("THREE.KeyframeTrack: Track is empty.",this),$=!1;let k=null;for(let K=0;K!==H;K++){let w=M[K];if(typeof w==="number"&&isNaN(w)){console.error("THREE.KeyframeTrack: Time is not a valid number.",this,K,w),$=!1;break}if(k!==null&&k>w){console.error("THREE.KeyframeTrack: Out of order keys.",this,K,w,k),$=!1;break}k=w}if(Q!==void 0){if(cH(Q))for(let K=0,w=Q.length;K!==w;++K){let W=Q[K];if(isNaN(W)){console.error("THREE.KeyframeTrack: Value is not a valid number.",this,K,W),$=!1;break}}}return $}optimize(){let $=this.times.slice(),J=this.values.slice(),M=this.getValueSize(),Q=this.getInterpolation()===2302,H=$.length-1,k=1;for(let K=1;K<H;++K){let w=!1,W=$[K],E=$[K+1];if(W!==E&&(K!==1||W!==$[0]))if(!Q){let R=K*M,Z=R-M,U=R+M;for(let X=0;X!==M;++X){let G=J[R+X];if(G!==J[Z+X]||G!==J[U+X]){w=!0;break}}}else w=!0;if(w){if(K!==k){$[k]=$[K];let R=K*M,Z=k*M;for(let U=0;U!==M;++U)J[Z+U]=J[R+U]}++k}}if(H>0){$[k]=$[H];for(let K=H*M,w=k*M,W=0;W!==M;++W)J[w+W]=J[K+W];++k}if(k!==$.length)this.times=$.slice(0,k),this.values=J.slice(0,k*M);else this.times=$,this.values=J;return this}clone(){let $=this.times.slice(),J=this.values.slice(),Q=new this.constructor(this.name,$,J);return Q.createInterpolant=this.createInterpolant,Q}}H5.prototype.ValueTypeName="";H5.prototype.TimeBufferType=Float32Array;H5.prototype.ValueBufferType=Float32Array;H5.prototype.DefaultInterpolation=2301;class Q8 extends H5{constructor($,J,M){super($,J,M)}}Q8.prototype.ValueTypeName="bool";Q8.prototype.ValueBufferType=Array;Q8.prototype.DefaultInterpolation=2300;Q8.prototype.InterpolantFactoryMethodLinear=void 0;Q8.prototype.InterpolantFactoryMethodSmooth=void 0;class V7 extends H5{constructor($,J,M,Q){super($,J,M,Q)}}V7.prototype.ValueTypeName="color";class B7 extends H5{constructor($,J,M,Q){super($,J,M,Q)}}B7.prototype.ValueTypeName="number";class I7 extends b8{constructor($,J,M,Q){super($,J,M,Q)}interpolate_($,J,M,Q){let H=this.resultBuffer,k=this.sampleValues,K=this.valueSize,w=(M-J)/(Q-J),W=$*K;for(let E=W+K;W!==E;W+=4)m0.slerpFlat(H,0,k,W-K,k,W,w);return H}}class A$ extends H5{constructor($,J,M,Q){super($,J,M,Q)}InterpolantFactoryMethodLinear($){return new I7(this.times,this.values,this.getValueSize(),$)}}A$.prototype.ValueTypeName="quaternion";A$.prototype.InterpolantFactoryMethodSmooth=void 0;class H8 extends H5{constructor($,J,M){super($,J,M)}}H8.prototype.ValueTypeName="string";H8.prototype.ValueBufferType=Array;H8.prototype.DefaultInterpolation=2300;H8.prototype.InterpolantFactoryMethodLinear=void 0;H8.prototype.InterpolantFactoryMethodSmooth=void 0;class C7 extends H5{constructor($,J,M,Q){super($,J,M,Q)}}C7.prototype.ValueTypeName="vector";class _7{constructor($,J,M){let Q=this,H=!1,k=0,K=0,w=void 0,W=[];this.onStart=void 0,this.onLoad=$,this.onProgress=J,this.onError=M,this.abortController=new AbortController,this.itemStart=function(E){if(K++,H===!1){if(Q.onStart!==void 0)Q.onStart(E,k,K)}H=!0},this.itemEnd=function(E){if(k++,Q.onProgress!==void 0)Q.onProgress(E,k,K);if(k===K){if(H=!1,Q.onLoad!==void 0)Q.onLoad()}},this.itemError=function(E){if(Q.onError!==void 0)Q.onError(E)},this.resolveURL=function(E){if(w)return w(E);return E},this.setURLModifier=function(E){return w=E,this},this.addHandler=function(E,R){return W.push(E,R),this},this.removeHandler=function(E){let R=W.indexOf(E);if(R!==-1)W.splice(R,2);return this},this.getHandler=function(E){for(let R=0,Z=W.length;R<Z;R+=2){let U=W[R],X=W[R+1];if(U.global)U.lastIndex=0;if(U.test(E))return X}return null},this.abort=function(){return this.abortController.abort(),this.abortController=new AbortController,this}}}var oM=new _7;class A7{constructor($){this.manager=$!==void 0?$:oM,this.crossOrigin="anonymous",this.withCredentials=!1,this.path="",this.resourcePath="",this.requestHeader={}}load(){}loadAsync($,J){let M=this;return new Promise(function(Q,H){M.load($,Q,J,H)})}parse(){}setCrossOrigin($){return this.crossOrigin=$,this}setWithCredentials($){return this.withCredentials=$,this}setPath($){return this.path=$,this}setResourcePath($){return this.resourcePath=$,this}setRequestHeader($){return this.requestHeader=$,this}abort(){return this}}A7.DEFAULT_MATERIAL_NAME="__DEFAULT";class O6 extends V${constructor($=-1,J=1,M=1,Q=-1,H=0.1,k=2000){super();this.isOrthographicCamera=!0,this.type="OrthographicCamera",this.zoom=1,this.view=null,this.left=$,this.right=J,this.top=M,this.bottom=Q,this.near=H,this.far=k,this.updateProjectionMatrix()}copy($,J){return super.copy($,J),this.left=$.left,this.right=$.right,this.top=$.top,this.bottom=$.bottom,this.near=$.near,this.far=$.far,this.zoom=$.zoom,this.view=$.view===null?null:Object.assign({},$.view),this}setViewOffset($,J,M,Q,H,k){if(this.view===null)this.view={enabled:!0,fullWidth:1,fullHeight:1,offsetX:0,offsetY:0,width:1,height:1};this.view.enabled=!0,this.view.fullWidth=$,this.view.fullHeight=J,this.view.offsetX=M,this.view.offsetY=Q,this.view.width=H,this.view.height=k,this.updateProjectionMatrix()}clearViewOffset(){if(this.view!==null)this.view.enabled=!1;this.updateProjectionMatrix()}updateProjectionMatrix(){let $=(this.right-this.left)/(2*this.zoom),J=(this.top-this.bottom)/(2*this.zoom),M=(this.right+this.left)/2,Q=(this.top+this.bottom)/2,H=M-$,k=M+$,K=Q+J,w=Q-J;if(this.view!==null&&this.view.enabled){let W=(this.right-this.left)/this.view.fullWidth/this.zoom,E=(this.top-this.bottom)/this.view.fullHeight/this.zoom;H+=W*this.view.offsetX,k=H+W*this.view.width,K-=E*this.view.offsetY,w=K-E*this.view.height}this.projectionMatrix.makeOrthographic(H,k,K,w,this.near,this.far,this.coordinateSystem,this.reversedDepth),this.projectionMatrixInverse.copy(this.projectionMatrix).invert()}toJSON($){let J=super.toJSON($);if(J.object.zoom=this.zoom,J.object.left=this.left,J.object.right=this.right,J.object.top=this.top,J.object.bottom=this.bottom,J.object.near=this.near,J.object.far=this.far,this.view!==null)J.object.view=Object.assign({},this.view);return J}}class S7 extends L1{constructor($=[]){super();this.isArrayCamera=!0,this.isMultiViewCamera=!1,this.cameras=$}}var T7="\\[\\]\\.:\\/",nH=new RegExp("["+T7+"]","g"),h7="[^"+T7+"]",sH="[^"+T7.replace("\\.","")+"]",oH=/((?:WC+[\/:])*)/.source.replace("WC",h7),iH=/(WCOD+)?/.source.replace("WCOD",sH),rH=/(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC",h7),aH=/\.(WC+)(?:\[(.+)\])?/.source.replace("WC",h7),tH=new RegExp("^"+oH+iH+rH+aH+"$"),eH=["material","materials","bones","map"];class iM{constructor($,J,M){let Q=M||$1.parseTrackName(J);this._targetGroup=$,this._bindings=$.subscribe_(J,Q)}getValue($,J){this.bind();let M=this._targetGroup.nCachedObjects_,Q=this._bindings[M];if(Q!==void 0)Q.getValue($,J)}setValue($,J){let M=this._bindings;for(let Q=this._targetGroup.nCachedObjects_,H=M.length;Q!==H;++Q)M[Q].setValue($,J)}bind(){let $=this._bindings;for(let J=this._targetGroup.nCachedObjects_,M=$.length;J!==M;++J)$[J].bind()}unbind(){let $=this._bindings;for(let J=this._targetGroup.nCachedObjects_,M=$.length;J!==M;++J)$[J].unbind()}}class $1{constructor($,J,M){this.path=J,this.parsedPath=M||$1.parseTrackName(J),this.node=$1.findNode($,this.parsedPath.nodeName),this.rootNode=$,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}static create($,J,M){if(!($&&$.isAnimationObjectGroup))return new $1($,J,M);else return new $1.Composite($,J,M)}static sanitizeNodeName($){return $.replace(/\s/g,"_").replace(nH,"")}static parseTrackName($){let J=tH.exec($);if(J===null)throw Error("PropertyBinding: Cannot parse trackName: "+$);let M={nodeName:J[2],objectName:J[3],objectIndex:J[4],propertyName:J[5],propertyIndex:J[6]},Q=M.nodeName&&M.nodeName.lastIndexOf(".");if(Q!==void 0&&Q!==-1){let H=M.nodeName.substring(Q+1);if(eH.indexOf(H)!==-1)M.nodeName=M.nodeName.substring(0,Q),M.objectName=H}if(M.propertyName===null||M.propertyName.length===0)throw Error("PropertyBinding: can not parse propertyName from trackName: "+$);return M}static findNode($,J){if(J===void 0||J===""||J==="."||J===-1||J===$.name||J===$.uuid)return $;if($.skeleton){let M=$.skeleton.getBoneByName(J);if(M!==void 0)return M}if($.children){let M=function(H){for(let k=0;k<H.length;k++){let K=H[k];if(K.name===J||K.uuid===J)return K;let w=M(K.children);if(w)return w}return null},Q=M($.children);if(Q)return Q}return null}_getValue_unavailable(){}_setValue_unavailable(){}_getValue_direct($,J){$[J]=this.targetObject[this.propertyName]}_getValue_array($,J){let M=this.resolvedProperty;for(let Q=0,H=M.length;Q!==H;++Q)$[J++]=M[Q]}_getValue_arrayElement($,J){$[J]=this.resolvedProperty[this.propertyIndex]}_getValue_toArray($,J){this.resolvedProperty.toArray($,J)}_setValue_direct($,J){this.targetObject[this.propertyName]=$[J]}_setValue_direct_setNeedsUpdate($,J){this.targetObject[this.propertyName]=$[J],this.targetObject.needsUpdate=!0}_setValue_direct_setMatrixWorldNeedsUpdate($,J){this.targetObject[this.propertyName]=$[J],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_array($,J){let M=this.resolvedProperty;for(let Q=0,H=M.length;Q!==H;++Q)M[Q]=$[J++]}_setValue_array_setNeedsUpdate($,J){let M=this.resolvedProperty;for(let Q=0,H=M.length;Q!==H;++Q)M[Q]=$[J++];this.targetObject.needsUpdate=!0}_setValue_array_setMatrixWorldNeedsUpdate($,J){let M=this.resolvedProperty;for(let Q=0,H=M.length;Q!==H;++Q)M[Q]=$[J++];this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_arrayElement($,J){this.resolvedProperty[this.propertyIndex]=$[J]}_setValue_arrayElement_setNeedsUpdate($,J){this.resolvedProperty[this.propertyIndex]=$[J],this.targetObject.needsUpdate=!0}_setValue_arrayElement_setMatrixWorldNeedsUpdate($,J){this.resolvedProperty[this.propertyIndex]=$[J],this.targetObject.matrixWorldNeedsUpdate=!0}_setValue_fromArray($,J){this.resolvedProperty.fromArray($,J)}_setValue_fromArray_setNeedsUpdate($,J){this.resolvedProperty.fromArray($,J),this.targetObject.needsUpdate=!0}_setValue_fromArray_setMatrixWorldNeedsUpdate($,J){this.resolvedProperty.fromArray($,J),this.targetObject.matrixWorldNeedsUpdate=!0}_getValue_unbound($,J){this.bind(),this.getValue($,J)}_setValue_unbound($,J){this.bind(),this.setValue($,J)}bind(){let $=this.node,J=this.parsedPath,M=J.objectName,Q=J.propertyName,H=J.propertyIndex;if(!$)$=$1.findNode(this.rootNode,J.nodeName),this.node=$;if(this.getValue=this._getValue_unavailable,this.setValue=this._setValue_unavailable,!$){console.warn("THREE.PropertyBinding: No target node found for track: "+this.path+".");return}if(M){let W=J.objectIndex;switch(M){case"materials":if(!$.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!$.material.materials){console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.",this);return}$=$.material.materials;break;case"bones":if(!$.skeleton){console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.",this);return}$=$.skeleton.bones;for(let E=0;E<$.length;E++)if($[E].name===W){W=E;break}break;case"map":if("map"in $){$=$.map;break}if(!$.material){console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.",this);return}if(!$.material.map){console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.",this);return}$=$.material.map;break;default:if($[M]===void 0){console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.",this);return}$=$[M]}if(W!==void 0){if($[W]===void 0){console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.",this,$);return}$=$[W]}}let k=$[Q];if(k===void 0){let W=J.nodeName;console.error("THREE.PropertyBinding: Trying to update property for track: "+W+"."+Q+" but it wasn't found.",$);return}let K=this.Versioning.None;if(this.targetObject=$,$.isMaterial===!0)K=this.Versioning.NeedsUpdate;else if($.isObject3D===!0)K=this.Versioning.MatrixWorldNeedsUpdate;let w=this.BindingType.Direct;if(H!==void 0){if(Q==="morphTargetInfluences"){if(!$.geometry){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.",this);return}if(!$.geometry.morphAttributes){console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.",this);return}if($.morphTargetDictionary[H]!==void 0)H=$.morphTargetDictionary[H]}w=this.BindingType.ArrayElement,this.resolvedProperty=k,this.propertyIndex=H}else if(k.fromArray!==void 0&&k.toArray!==void 0)w=this.BindingType.HasFromToArray,this.resolvedProperty=k;else if(Array.isArray(k))w=this.BindingType.EntireArray,this.resolvedProperty=k;else this.propertyName=Q;this.getValue=this.GetterByBindingType[w],this.setValue=this.SetterByBindingTypeAndVersioning[w][K]}unbind(){this.node=null,this.getValue=this._getValue_unbound,this.setValue=this._setValue_unbound}}$1.Composite=iM;$1.prototype.BindingType={Direct:0,EntireArray:1,ArrayElement:2,HasFromToArray:3};$1.prototype.Versioning={None:0,NeedsUpdate:1,MatrixWorldNeedsUpdate:2};$1.prototype.GetterByBindingType=[$1.prototype._getValue_direct,$1.prototype._getValue_array,$1.prototype._getValue_arrayElement,$1.prototype._getValue_toArray];$1.prototype.SetterByBindingTypeAndVersioning=[[$1.prototype._setValue_direct,$1.prototype._setValue_direct_setNeedsUpdate,$1.prototype._setValue_direct_setMatrixWorldNeedsUpdate],[$1.prototype._setValue_array,$1.prototype._setValue_array_setNeedsUpdate,$1.prototype._setValue_array_setMatrixWorldNeedsUpdate],[$1.prototype._setValue_arrayElement,$1.prototype._setValue_arrayElement_setNeedsUpdate,$1.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate],[$1.prototype._setValue_fromArray,$1.prototype._setValue_fromArray_setNeedsUpdate,$1.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate]];var WZ=new Float32Array(1);function f7($,J,M,Q){let H=$k(Q);switch(M){case 1021:return $*J;case 1028:return $*J/H.components*H.byteLength;case 1029:return $*J/H.components*H.byteLength;case 1030:return $*J*2/H.components*H.byteLength;case 1031:return $*J*2/H.components*H.byteLength;case 1022:return $*J*3/H.components*H.byteLength;case 1023:return $*J*4/H.components*H.byteLength;case 1033:return $*J*4/H.components*H.byteLength;case 33776:case 33777:return Math.floor(($+3)/4)*Math.floor((J+3)/4)*8;case 33778:case 33779:return Math.floor(($+3)/4)*Math.floor((J+3)/4)*16;case 35841:case 35843:return Math.max($,16)*Math.max(J,8)/4;case 35840:case 35842:return Math.max($,8)*Math.max(J,8)/2;case 36196:case 37492:return Math.floor(($+3)/4)*Math.floor((J+3)/4)*8;case 37496:return Math.floor(($+3)/4)*Math.floor((J+3)/4)*16;case 37808:return Math.floor(($+3)/4)*Math.floor((J+3)/4)*16;case 37809:return Math.floor(($+4)/5)*Math.floor((J+3)/4)*16;case 37810:return Math.floor(($+4)/5)*Math.floor((J+4)/5)*16;case 37811:return Math.floor(($+5)/6)*Math.floor((J+4)/5)*16;case 37812:return Math.floor(($+5)/6)*Math.floor((J+5)/6)*16;case 37813:return Math.floor(($+7)/8)*Math.floor((J+4)/5)*16;case 37814:return Math.floor(($+7)/8)*Math.floor((J+5)/6)*16;case 37815:return Math.floor(($+7)/8)*Math.floor((J+7)/8)*16;case 37816:return Math.floor(($+9)/10)*Math.floor((J+4)/5)*16;case 37817:return Math.floor(($+9)/10)*Math.floor((J+5)/6)*16;case 37818:return Math.floor(($+9)/10)*Math.floor((J+7)/8)*16;case 37819:return Math.floor(($+9)/10)*Math.floor((J+9)/10)*16;case 37820:return Math.floor(($+11)/12)*Math.floor((J+9)/10)*16;case 37821:return Math.floor(($+11)/12)*Math.floor((J+11)/12)*16;case 36492:case 36494:case 36495:return Math.ceil($/4)*Math.ceil(J/4)*16;case 36283:case 36284:return Math.ceil($/4)*Math.ceil(J/4)*8;case 36285:case 36286:return Math.ceil($/4)*Math.ceil(J/4)*16}throw Error(`Unable to determine texture byte length for ${M} format.`)}function $k($){switch($){case 1009:case 1010:return{byteLength:1,components:1};case 1012:case 1011:case 1016:return{byteLength:2,components:1};case 1017:case 1018:return{byteLength:2,components:4};case 1014:case 1013:case 1015:return{byteLength:4,components:1};case 35902:return{byteLength:4,components:3}}throw Error(`Unknown texture type ${$}.`)}if(typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register",{detail:{revision:"179"}}));if(typeof window<"u")if(window.__THREE__)console.warn("WARNING: Multiple instances of Three.js being imported.");else window.__THREE__="179";function OQ(){let $=null,J=!1,M=null,Q=null;function H(k,K){M(k,K),Q=$.requestAnimationFrame(H)}return{start:function(){if(J===!0)return;if(M===null)return;Q=$.requestAnimationFrame(H),J=!0},stop:function(){$.cancelAnimationFrame(Q),J=!1},setAnimationLoop:function(k){M=k},setContext:function(k){$=k}}}function Jk($){let J=new WeakMap;function M(w,W){let{array:E,usage:R}=w,Z=E.byteLength,U=$.createBuffer();$.bindBuffer(W,U),$.bufferData(W,E,R),w.onUploadCallback();let X;if(E instanceof Float32Array)X=$.FLOAT;else if(typeof Float16Array<"u"&&E instanceof Float16Array)X=$.HALF_FLOAT;else if(E instanceof Uint16Array)if(w.isFloat16BufferAttribute)X=$.HALF_FLOAT;else X=$.UNSIGNED_SHORT;else if(E instanceof Int16Array)X=$.SHORT;else if(E instanceof Uint32Array)X=$.UNSIGNED_INT;else if(E instanceof Int32Array)X=$.INT;else if(E instanceof Int8Array)X=$.BYTE;else if(E instanceof Uint8Array)X=$.UNSIGNED_BYTE;else if(E instanceof Uint8ClampedArray)X=$.UNSIGNED_BYTE;else throw Error("THREE.WebGLAttributes: Unsupported buffer data format: "+E);return{buffer:U,type:X,bytesPerElement:E.BYTES_PER_ELEMENT,version:w.version,size:Z}}function Q(w,W,E){let{array:R,updateRanges:Z}=W;if($.bindBuffer(E,w),Z.length===0)$.bufferSubData(E,0,R);else{Z.sort((X,G)=>X.start-G.start);let U=0;for(let X=1;X<Z.length;X++){let G=Z[U],q=Z[X];if(q.start<=G.start+G.count+1)G.count=Math.max(G.count,q.start+q.count-G.start);else++U,Z[U]=q}Z.length=U+1;for(let X=0,G=Z.length;X<G;X++){let q=Z[X];$.bufferSubData(E,q.start*R.BYTES_PER_ELEMENT,R,q.start,q.count)}W.clearUpdateRanges()}W.onUploadCallback()}function H(w){if(w.isInterleavedBufferAttribute)w=w.data;return J.get(w)}function k(w){if(w.isInterleavedBufferAttribute)w=w.data;let W=J.get(w);if(W)$.deleteBuffer(W.buffer),J.delete(w)}function K(w,W){if(w.isInterleavedBufferAttribute)w=w.data;if(w.isGLBufferAttribute){let R=J.get(w);if(!R||R.version<w.version)J.set(w,{buffer:w.buffer,type:w.type,bytesPerElement:w.elementSize,version:w.version});return}let E=J.get(w);if(E===void 0)J.set(w,M(w,W));else if(E.version<w.version){if(E.size!==w.array.byteLength)throw Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");Q(E.buffer,w,W),E.version=w.version}}return{get:H,remove:k,update:K}}var Mk=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Qk=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Hk=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,kk=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Kk=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,wk=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Wk=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,Ek=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Zk=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,Rk=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Uk=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,Yk=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,Nk=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Xk=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,Gk=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Dk=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,qk=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,Ok=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,Fk=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,Lk=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,Pk=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,zk=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,Vk=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,Bk=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,Ik=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,Ck=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,_k=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,Ak=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,Sk=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,Tk=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,hk="gl_FragColor = linearToOutputTexel( gl_FragColor );",fk=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,yk=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,jk=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,vk=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,bk=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,pk=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,xk=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,gk=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,lk=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,dk=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,mk=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,uk=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,ck=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,nk=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,sk=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,ok=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,ik=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,rk=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,ak=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,tk=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,ek=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,$K=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,JK=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,MK=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,QK=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,HK=`#if defined( USE_LOGDEPTHBUF )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,kK=`#if defined( USE_LOGDEPTHBUF )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,KK=`#ifdef USE_LOGDEPTHBUF
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,wK=`#ifdef USE_LOGDEPTHBUF
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,WK=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,EK=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,ZK=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,RK=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,UK=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,YK=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,NK=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,XK=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,GK=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,DK=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,qK=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,OK=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,FK=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,LK=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,PK=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,zK=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,VK=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,BK=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,IK=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,CK=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,_K=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,AK=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,SK=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,TK=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,hK=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,fK=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,yK=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,jK=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,vK=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,bK=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		float depth = unpackRGBAToDepth( texture2D( depths, uv ) );
		#ifdef USE_REVERSEDEPTHBUF
			return step( depth, compare );
		#else
			return step( compare, depth );
		#endif
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow (sampler2D shadow, vec2 uv, float compare ){
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		#ifdef USE_REVERSEDEPTHBUF
			float hard_shadow = step( distribution.x, compare );
		#else
			float hard_shadow = step( compare , distribution.x );
		#endif
		if (hard_shadow != 1.0 ) {
			float distance = compare - distribution.x ;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,pK=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,xK=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,gK=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,lK=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,dK=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,mK=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,uK=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,cK=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,nK=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,sK=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,oK=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,iK=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,rK=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,aK=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,tK=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,eK=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,$w=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`,Jw=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Mw=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Qw=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Hw=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,kw=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Kw=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,ww=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Ww=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSEDEPTHBUF
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,Ew=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Zw=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,Rw=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Uw=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Yw=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,Nw=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Xw=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,Gw=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Dw=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,qw=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Ow=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,Fw=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Lw=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,Pw=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,zw=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Vw=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Bw=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,Iw=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Cw=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,_w=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Aw=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,Sw=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Tw=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,hw=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,fw=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,yw=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,g0={alphahash_fragment:Mk,alphahash_pars_fragment:Qk,alphamap_fragment:Hk,alphamap_pars_fragment:kk,alphatest_fragment:Kk,alphatest_pars_fragment:wk,aomap_fragment:Wk,aomap_pars_fragment:Ek,batching_pars_vertex:Zk,batching_vertex:Rk,begin_vertex:Uk,beginnormal_vertex:Yk,bsdfs:Nk,iridescence_fragment:Xk,bumpmap_pars_fragment:Gk,clipping_planes_fragment:Dk,clipping_planes_pars_fragment:qk,clipping_planes_pars_vertex:Ok,clipping_planes_vertex:Fk,color_fragment:Lk,color_pars_fragment:Pk,color_pars_vertex:zk,color_vertex:Vk,common:Bk,cube_uv_reflection_fragment:Ik,defaultnormal_vertex:Ck,displacementmap_pars_vertex:_k,displacementmap_vertex:Ak,emissivemap_fragment:Sk,emissivemap_pars_fragment:Tk,colorspace_fragment:hk,colorspace_pars_fragment:fk,envmap_fragment:yk,envmap_common_pars_fragment:jk,envmap_pars_fragment:vk,envmap_pars_vertex:bk,envmap_physical_pars_fragment:ok,envmap_vertex:pk,fog_vertex:xk,fog_pars_vertex:gk,fog_fragment:lk,fog_pars_fragment:dk,gradientmap_pars_fragment:mk,lightmap_pars_fragment:uk,lights_lambert_fragment:ck,lights_lambert_pars_fragment:nk,lights_pars_begin:sk,lights_toon_fragment:ik,lights_toon_pars_fragment:rk,lights_phong_fragment:ak,lights_phong_pars_fragment:tk,lights_physical_fragment:ek,lights_physical_pars_fragment:$K,lights_fragment_begin:JK,lights_fragment_maps:MK,lights_fragment_end:QK,logdepthbuf_fragment:HK,logdepthbuf_pars_fragment:kK,logdepthbuf_pars_vertex:KK,logdepthbuf_vertex:wK,map_fragment:WK,map_pars_fragment:EK,map_particle_fragment:ZK,map_particle_pars_fragment:RK,metalnessmap_fragment:UK,metalnessmap_pars_fragment:YK,morphinstance_vertex:NK,morphcolor_vertex:XK,morphnormal_vertex:GK,morphtarget_pars_vertex:DK,morphtarget_vertex:qK,normal_fragment_begin:OK,normal_fragment_maps:FK,normal_pars_fragment:LK,normal_pars_vertex:PK,normal_vertex:zK,normalmap_pars_fragment:VK,clearcoat_normal_fragment_begin:BK,clearcoat_normal_fragment_maps:IK,clearcoat_pars_fragment:CK,iridescence_pars_fragment:_K,opaque_fragment:AK,packing:SK,premultiplied_alpha_fragment:TK,project_vertex:hK,dithering_fragment:fK,dithering_pars_fragment:yK,roughnessmap_fragment:jK,roughnessmap_pars_fragment:vK,shadowmap_pars_fragment:bK,shadowmap_pars_vertex:pK,shadowmap_vertex:xK,shadowmask_pars_fragment:gK,skinbase_vertex:lK,skinning_pars_vertex:dK,skinning_vertex:mK,skinnormal_vertex:uK,specularmap_fragment:cK,specularmap_pars_fragment:nK,tonemapping_fragment:sK,tonemapping_pars_fragment:oK,transmission_fragment:iK,transmission_pars_fragment:rK,uv_pars_fragment:aK,uv_pars_vertex:tK,uv_vertex:eK,worldpos_vertex:$w,background_vert:Jw,background_frag:Mw,backgroundCube_vert:Qw,backgroundCube_frag:Hw,cube_vert:kw,cube_frag:Kw,depth_vert:ww,depth_frag:Ww,distanceRGBA_vert:Ew,distanceRGBA_frag:Zw,equirect_vert:Rw,equirect_frag:Uw,linedashed_vert:Yw,linedashed_frag:Nw,meshbasic_vert:Xw,meshbasic_frag:Gw,meshlambert_vert:Dw,meshlambert_frag:qw,meshmatcap_vert:Ow,meshmatcap_frag:Fw,meshnormal_vert:Lw,meshnormal_frag:Pw,meshphong_vert:zw,meshphong_frag:Vw,meshphysical_vert:Bw,meshphysical_frag:Iw,meshtoon_vert:Cw,meshtoon_frag:_w,points_vert:Aw,points_frag:Sw,shadow_vert:Tw,shadow_frag:hw,sprite_vert:fw,sprite_frag:yw},Y0={common:{diffuse:{value:new e0(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new p0},alphaMap:{value:null},alphaMapTransform:{value:new p0},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new p0}},envmap:{envMap:{value:null},envMapRotation:{value:new p0},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:0.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new p0}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new p0}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new p0},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new p0},normalScale:{value:new J1(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new p0},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new p0}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new p0}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new p0}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:0.00025},fogNear:{value:1},fogFar:{value:2000},fogColor:{value:new e0(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new e0(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new p0},alphaTest:{value:0},uvTransform:{value:new p0}},sprite:{diffuse:{value:new e0(16777215)},opacity:{value:1},center:{value:new J1(0.5,0.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new p0},alphaMap:{value:null},alphaMapTransform:{value:new p0},alphaTest:{value:0}}},X5={basic:{uniforms:_1([Y0.common,Y0.specularmap,Y0.envmap,Y0.aomap,Y0.lightmap,Y0.fog]),vertexShader:g0.meshbasic_vert,fragmentShader:g0.meshbasic_frag},lambert:{uniforms:_1([Y0.common,Y0.specularmap,Y0.envmap,Y0.aomap,Y0.lightmap,Y0.emissivemap,Y0.bumpmap,Y0.normalmap,Y0.displacementmap,Y0.fog,Y0.lights,{emissive:{value:new e0(0)}}]),vertexShader:g0.meshlambert_vert,fragmentShader:g0.meshlambert_frag},phong:{uniforms:_1([Y0.common,Y0.specularmap,Y0.envmap,Y0.aomap,Y0.lightmap,Y0.emissivemap,Y0.bumpmap,Y0.normalmap,Y0.displacementmap,Y0.fog,Y0.lights,{emissive:{value:new e0(0)},specular:{value:new e0(1118481)},shininess:{value:30}}]),vertexShader:g0.meshphong_vert,fragmentShader:g0.meshphong_frag},standard:{uniforms:_1([Y0.common,Y0.envmap,Y0.aomap,Y0.lightmap,Y0.emissivemap,Y0.bumpmap,Y0.normalmap,Y0.displacementmap,Y0.roughnessmap,Y0.metalnessmap,Y0.fog,Y0.lights,{emissive:{value:new e0(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:g0.meshphysical_vert,fragmentShader:g0.meshphysical_frag},toon:{uniforms:_1([Y0.common,Y0.aomap,Y0.lightmap,Y0.emissivemap,Y0.bumpmap,Y0.normalmap,Y0.displacementmap,Y0.gradientmap,Y0.fog,Y0.lights,{emissive:{value:new e0(0)}}]),vertexShader:g0.meshtoon_vert,fragmentShader:g0.meshtoon_frag},matcap:{uniforms:_1([Y0.common,Y0.bumpmap,Y0.normalmap,Y0.displacementmap,Y0.fog,{matcap:{value:null}}]),vertexShader:g0.meshmatcap_vert,fragmentShader:g0.meshmatcap_frag},points:{uniforms:_1([Y0.points,Y0.fog]),vertexShader:g0.points_vert,fragmentShader:g0.points_frag},dashed:{uniforms:_1([Y0.common,Y0.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:g0.linedashed_vert,fragmentShader:g0.linedashed_frag},depth:{uniforms:_1([Y0.common,Y0.displacementmap]),vertexShader:g0.depth_vert,fragmentShader:g0.depth_frag},normal:{uniforms:_1([Y0.common,Y0.bumpmap,Y0.normalmap,Y0.displacementmap,{opacity:{value:1}}]),vertexShader:g0.meshnormal_vert,fragmentShader:g0.meshnormal_frag},sprite:{uniforms:_1([Y0.sprite,Y0.fog]),vertexShader:g0.sprite_vert,fragmentShader:g0.sprite_frag},background:{uniforms:{uvTransform:{value:new p0},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:g0.background_vert,fragmentShader:g0.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new p0}},vertexShader:g0.backgroundCube_vert,fragmentShader:g0.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:g0.cube_vert,fragmentShader:g0.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:g0.equirect_vert,fragmentShader:g0.equirect_frag},distanceRGBA:{uniforms:_1([Y0.common,Y0.displacementmap,{referencePosition:{value:new A},nearDistance:{value:1},farDistance:{value:1000}}]),vertexShader:g0.distanceRGBA_vert,fragmentShader:g0.distanceRGBA_frag},shadow:{uniforms:_1([Y0.lights,Y0.fog,{color:{value:new e0(0)},opacity:{value:1}}]),vertexShader:g0.shadow_vert,fragmentShader:g0.shadow_frag}};X5.physical={uniforms:_1([X5.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new p0},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new p0},clearcoatNormalScale:{value:new J1(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new p0},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new p0},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new p0},sheen:{value:0},sheenColor:{value:new e0(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new p0},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new p0},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new p0},transmissionSamplerSize:{value:new J1},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new p0},attenuationDistance:{value:0},attenuationColor:{value:new e0(0)},specularColor:{value:new e0(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new p0},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new p0},anisotropyVector:{value:new J1},anisotropyMap:{value:null},anisotropyMapTransform:{value:new p0}}]),vertexShader:g0.meshphysical_vert,fragmentShader:g0.meshphysical_frag};var S$={r:0,b:0,g:0},k8=new u1,jw=new H1;function vw($,J,M,Q,H,k,K){let w=new e0(0),W=k===!0?0:1,E,R,Z=null,U=0,X=null;function G(D){let P=D.isScene===!0?D.background:null;if(P&&P.isTexture)P=(D.backgroundBlurriness>0?M:J).get(P);return P}function q(D){let P=!1,h=G(D);if(h===null)N(w,W);else if(h&&h.isColor)N(h,1),P=!0;let B=$.xr.getEnvironmentBlendMode();if(B==="additive")Q.buffers.color.setClear(0,0,0,1,K);else if(B==="alpha-blend")Q.buffers.color.setClear(0,0,0,0,K);if($.autoClear||P)Q.buffers.depth.setTest(!0),Q.buffers.depth.setMask(!0),Q.buffers.color.setMask(!0),$.clear($.autoClearColor,$.autoClearDepth,$.autoClearStencil)}function Y(D,P){let h=G(P);if(h&&(h.isCubeTexture||h.mapping===W6)){if(R===void 0)R=new j1(new j8(1,1,1),new Q5({name:"BackgroundCubeMaterial",uniforms:M8(X5.backgroundCube.uniforms),vertexShader:X5.backgroundCube.vertexShader,fragmentShader:X5.backgroundCube.fragmentShader,side:c1,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),R.geometry.deleteAttribute("normal"),R.geometry.deleteAttribute("uv"),R.onBeforeRender=function(B,S,b){this.matrixWorld.copyPosition(b.matrixWorld)},Object.defineProperty(R.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),H.update(R);if(k8.copy(P.backgroundRotation),k8.x*=-1,k8.y*=-1,k8.z*=-1,h.isCubeTexture&&h.isRenderTargetTexture===!1)k8.y*=-1,k8.z*=-1;if(R.material.uniforms.envMap.value=h,R.material.uniforms.flipEnvMap.value=h.isCubeTexture&&h.isRenderTargetTexture===!1?-1:1,R.material.uniforms.backgroundBlurriness.value=P.backgroundBlurriness,R.material.uniforms.backgroundIntensity.value=P.backgroundIntensity,R.material.uniforms.backgroundRotation.value.setFromMatrix4(jw.makeRotationFromEuler(k8)),R.material.toneMapped=r0.getTransfer(h.colorSpace)!==K1,Z!==h||U!==h.version||X!==$.toneMapping)R.material.needsUpdate=!0,Z=h,U=h.version,X=$.toneMapping;R.layers.enableAll(),D.unshift(R,R.geometry,R.material,0,0,null)}else if(h&&h.isTexture){if(E===void 0)E=new j1(new q6(2,2),new Q5({name:"BackgroundMaterial",uniforms:M8(X5.background.uniforms),vertexShader:X5.background.vertexShader,fragmentShader:X5.background.fragmentShader,side:Y5,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),E.geometry.deleteAttribute("normal"),Object.defineProperty(E.material,"map",{get:function(){return this.uniforms.t2D.value}}),H.update(E);if(E.material.uniforms.t2D.value=h,E.material.uniforms.backgroundIntensity.value=P.backgroundIntensity,E.material.toneMapped=r0.getTransfer(h.colorSpace)!==K1,h.matrixAutoUpdate===!0)h.updateMatrix();if(E.material.uniforms.uvTransform.value.copy(h.matrix),Z!==h||U!==h.version||X!==$.toneMapping)E.material.needsUpdate=!0,Z=h,U=h.version,X=$.toneMapping;E.layers.enableAll(),D.unshift(E,E.geometry,E.material,0,0,null)}}function N(D,P){D.getRGB(S$,X7($)),Q.buffers.color.setClear(S$.r,S$.g,S$.b,P,K)}function V(){if(R!==void 0)R.geometry.dispose(),R.material.dispose(),R=void 0;if(E!==void 0)E.geometry.dispose(),E.material.dispose(),E=void 0}return{getClearColor:function(){return w},setClearColor:function(D,P=1){w.set(D),W=P,N(w,W)},getClearAlpha:function(){return W},setClearAlpha:function(D){W=D,N(w,W)},render:q,addToRenderList:Y,dispose:V}}function bw($,J){let M=$.getParameter($.MAX_VERTEX_ATTRIBS),Q={},H=U(null),k=H,K=!1;function w(O,f,g,p,u){let t=!1,m=Z(p,g,f);if(k!==m)k=m,E(k.object);if(t=X(O,p,g,u),t)G(O,p,g,u);if(u!==null)J.update(u,$.ELEMENT_ARRAY_BUFFER);if(t||K){if(K=!1,P(O,f,g,p),u!==null)$.bindBuffer($.ELEMENT_ARRAY_BUFFER,J.get(u).buffer)}}function W(){return $.createVertexArray()}function E(O){return $.bindVertexArray(O)}function R(O){return $.deleteVertexArray(O)}function Z(O,f,g){let p=g.wireframe===!0,u=Q[O.id];if(u===void 0)u={},Q[O.id]=u;let t=u[f.id];if(t===void 0)t={},u[f.id]=t;let m=t[p];if(m===void 0)m=U(W()),t[p]=m;return m}function U(O){let f=[],g=[],p=[];for(let u=0;u<M;u++)f[u]=0,g[u]=0,p[u]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:f,enabledAttributes:g,attributeDivisors:p,object:O,attributes:{},index:null}}function X(O,f,g,p){let u=k.attributes,t=f.attributes,m=0,e=g.getAttributes();for(let d in e)if(e[d].location>=0){let w0=u[d],D0=t[d];if(D0===void 0){if(d==="instanceMatrix"&&O.instanceMatrix)D0=O.instanceMatrix;if(d==="instanceColor"&&O.instanceColor)D0=O.instanceColor}if(w0===void 0)return!0;if(w0.attribute!==D0)return!0;if(D0&&w0.data!==D0.data)return!0;m++}if(k.attributesNum!==m)return!0;if(k.index!==p)return!0;return!1}function G(O,f,g,p){let u={},t=f.attributes,m=0,e=g.getAttributes();for(let d in e)if(e[d].location>=0){let w0=t[d];if(w0===void 0){if(d==="instanceMatrix"&&O.instanceMatrix)w0=O.instanceMatrix;if(d==="instanceColor"&&O.instanceColor)w0=O.instanceColor}let D0={};if(D0.attribute=w0,w0&&w0.data)D0.data=w0.data;u[d]=D0,m++}k.attributes=u,k.attributesNum=m,k.index=p}function q(){let O=k.newAttributes;for(let f=0,g=O.length;f<g;f++)O[f]=0}function Y(O){N(O,0)}function N(O,f){let{newAttributes:g,enabledAttributes:p,attributeDivisors:u}=k;if(g[O]=1,p[O]===0)$.enableVertexAttribArray(O),p[O]=1;if(u[O]!==f)$.vertexAttribDivisor(O,f),u[O]=f}function V(){let{newAttributes:O,enabledAttributes:f}=k;for(let g=0,p=f.length;g<p;g++)if(f[g]!==O[g])$.disableVertexAttribArray(g),f[g]=0}function D(O,f,g,p,u,t,m){if(m===!0)$.vertexAttribIPointer(O,f,g,u,t);else $.vertexAttribPointer(O,f,g,p,u,t)}function P(O,f,g,p){q();let u=p.attributes,t=g.getAttributes(),m=f.defaultAttributeValues;for(let e in t){let d=t[e];if(d.location>=0){let Q0=u[e];if(Q0===void 0){if(e==="instanceMatrix"&&O.instanceMatrix)Q0=O.instanceMatrix;if(e==="instanceColor"&&O.instanceColor)Q0=O.instanceColor}if(Q0!==void 0){let{normalized:w0,itemSize:D0}=Q0,v0=J.get(Q0);if(v0===void 0)continue;let{buffer:l0,type:c,bytesPerElement:R0}=v0,G0=c===$.INT||c===$.UNSIGNED_INT||Q0.gpuType===A9;if(Q0.isInterleavedBufferAttribute){let H0=Q0.data,E0=H0.stride,T0=Q0.offset;if(H0.isInstancedInterleavedBuffer){for(let h0=0;h0<d.locationSize;h0++)N(d.location+h0,H0.meshPerAttribute);if(O.isInstancedMesh!==!0&&p._maxInstanceCount===void 0)p._maxInstanceCount=H0.meshPerAttribute*H0.count}else for(let h0=0;h0<d.locationSize;h0++)Y(d.location+h0);$.bindBuffer($.ARRAY_BUFFER,l0);for(let h0=0;h0<d.locationSize;h0++)D(d.location+h0,D0/d.locationSize,c,w0,E0*R0,(T0+D0/d.locationSize*h0)*R0,G0)}else{if(Q0.isInstancedBufferAttribute){for(let H0=0;H0<d.locationSize;H0++)N(d.location+H0,Q0.meshPerAttribute);if(O.isInstancedMesh!==!0&&p._maxInstanceCount===void 0)p._maxInstanceCount=Q0.meshPerAttribute*Q0.count}else for(let H0=0;H0<d.locationSize;H0++)Y(d.location+H0);$.bindBuffer($.ARRAY_BUFFER,l0);for(let H0=0;H0<d.locationSize;H0++)D(d.location+H0,D0/d.locationSize,c,w0,D0*R0,D0/d.locationSize*H0*R0,G0)}}else if(m!==void 0){let w0=m[e];if(w0!==void 0)switch(w0.length){case 2:$.vertexAttrib2fv(d.location,w0);break;case 3:$.vertexAttrib3fv(d.location,w0);break;case 4:$.vertexAttrib4fv(d.location,w0);break;default:$.vertexAttrib1fv(d.location,w0)}}}}V()}function h(){b();for(let O in Q){let f=Q[O];for(let g in f){let p=f[g];for(let u in p)R(p[u].object),delete p[u];delete f[g]}delete Q[O]}}function B(O){if(Q[O.id]===void 0)return;let f=Q[O.id];for(let g in f){let p=f[g];for(let u in p)R(p[u].object),delete p[u];delete f[g]}delete Q[O.id]}function S(O){for(let f in Q){let g=Q[f];if(g[O.id]===void 0)continue;let p=g[O.id];for(let u in p)R(p[u].object),delete p[u];delete g[O.id]}}function b(){if(z(),K=!0,k===H)return;k=H,E(k.object)}function z(){H.geometry=null,H.program=null,H.wireframe=!1}return{setup:w,reset:b,resetDefaultState:z,dispose:h,releaseStatesOfGeometry:B,releaseStatesOfProgram:S,initAttributes:q,enableAttribute:Y,disableUnusedAttributes:V}}function pw($,J,M){let Q;function H(E){Q=E}function k(E,R){$.drawArrays(Q,E,R),M.update(R,Q,1)}function K(E,R,Z){if(Z===0)return;$.drawArraysInstanced(Q,E,R,Z),M.update(R,Q,Z)}function w(E,R,Z){if(Z===0)return;J.get("WEBGL_multi_draw").multiDrawArraysWEBGL(Q,E,0,R,0,Z);let X=0;for(let G=0;G<Z;G++)X+=R[G];M.update(X,Q,1)}function W(E,R,Z,U){if(Z===0)return;let X=J.get("WEBGL_multi_draw");if(X===null)for(let G=0;G<E.length;G++)K(E[G],R[G],U[G]);else{X.multiDrawArraysInstancedWEBGL(Q,E,0,R,0,U,0,Z);let G=0;for(let q=0;q<Z;q++)G+=R[q]*U[q];M.update(G,Q,1)}}this.setMode=H,this.render=k,this.renderInstances=K,this.renderMultiDraw=w,this.renderMultiDrawInstances=W}function xw($,J,M,Q){let H;function k(){if(H!==void 0)return H;if(J.has("EXT_texture_filter_anisotropic")===!0){let S=J.get("EXT_texture_filter_anisotropic");H=$.getParameter(S.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else H=0;return H}function K(S){if(S!==J5&&Q.convert(S)!==$.getParameter($.IMPLEMENTATION_COLOR_READ_FORMAT))return!1;return!0}function w(S){let b=S===R6&&(J.has("EXT_color_buffer_half_float")||J.has("EXT_color_buffer_float"));if(S!==N5&&Q.convert(S)!==$.getParameter($.IMPLEMENTATION_COLOR_READ_TYPE)&&S!==b5&&!b)return!1;return!0}function W(S){if(S==="highp"){if($.getShaderPrecisionFormat($.VERTEX_SHADER,$.HIGH_FLOAT).precision>0&&$.getShaderPrecisionFormat($.FRAGMENT_SHADER,$.HIGH_FLOAT).precision>0)return"highp";S="mediump"}if(S==="mediump"){if($.getShaderPrecisionFormat($.VERTEX_SHADER,$.MEDIUM_FLOAT).precision>0&&$.getShaderPrecisionFormat($.FRAGMENT_SHADER,$.MEDIUM_FLOAT).precision>0)return"mediump"}return"lowp"}let E=M.precision!==void 0?M.precision:"highp",R=W(E);if(R!==E)console.warn("THREE.WebGLRenderer:",E,"not supported, using",R,"instead."),E=R;let Z=M.logarithmicDepthBuffer===!0,U=M.reversedDepthBuffer===!0&&J.has("EXT_clip_control"),X=$.getParameter($.MAX_TEXTURE_IMAGE_UNITS),G=$.getParameter($.MAX_VERTEX_TEXTURE_IMAGE_UNITS),q=$.getParameter($.MAX_TEXTURE_SIZE),Y=$.getParameter($.MAX_CUBE_MAP_TEXTURE_SIZE),N=$.getParameter($.MAX_VERTEX_ATTRIBS),V=$.getParameter($.MAX_VERTEX_UNIFORM_VECTORS),D=$.getParameter($.MAX_VARYING_VECTORS),P=$.getParameter($.MAX_FRAGMENT_UNIFORM_VECTORS),h=G>0,B=$.getParameter($.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:k,getMaxPrecision:W,textureFormatReadable:K,textureTypeReadable:w,precision:E,logarithmicDepthBuffer:Z,reversedDepthBuffer:U,maxTextures:X,maxVertexTextures:G,maxTextureSize:q,maxCubemapSize:Y,maxAttributes:N,maxVertexUniforms:V,maxVaryings:D,maxFragmentUniforms:P,vertexTextures:h,maxSamples:B}}function gw($){let J=this,M=null,Q=0,H=!1,k=!1,K=new e1,w=new p0,W={value:null,needsUpdate:!1};this.uniform=W,this.numPlanes=0,this.numIntersection=0,this.init=function(Z,U){let X=Z.length!==0||U||Q!==0||H;return H=U,Q=Z.length,X},this.beginShadows=function(){k=!0,R(null)},this.endShadows=function(){k=!1},this.setGlobalState=function(Z,U){M=R(Z,U,0)},this.setState=function(Z,U,X){let{clippingPlanes:G,clipIntersection:q,clipShadows:Y}=Z,N=$.get(Z);if(!H||G===null||G.length===0||k&&!Y)if(k)R(null);else E();else{let V=k?0:Q,D=V*4,P=N.clippingState||null;W.value=P,P=R(G,U,D,X);for(let h=0;h!==D;++h)P[h]=M[h];N.clippingState=P,this.numIntersection=q?this.numPlanes:0,this.numPlanes+=V}};function E(){if(W.value!==M)W.value=M,W.needsUpdate=Q>0;J.numPlanes=Q,J.numIntersection=0}function R(Z,U,X,G){let q=Z!==null?Z.length:0,Y=null;if(q!==0){if(Y=W.value,G!==!0||Y===null){let N=X+q*4,V=U.matrixWorldInverse;if(w.getNormalMatrix(V),Y===null||Y.length<N)Y=new Float32Array(N);for(let D=0,P=X;D!==q;++D,P+=4)K.copy(Z[D]).applyMatrix4(V,w),K.normal.toArray(Y,P),Y[P+3]=K.constant}W.value=Y,W.needsUpdate=!0}return J.numPlanes=q,J.numIntersection=0,Y}}function lw($){let J=new WeakMap;function M(K,w){if(w===Z$)K.mapping=S8;else if(w===R$)K.mapping=a5;return K}function Q(K){if(K&&K.isTexture){let w=K.mapping;if(w===Z$||w===R$)if(J.has(K)){let W=J.get(K).texture;return M(W,K.mapping)}else{let W=K.image;if(W&&W.height>0){let E=new D7(W.height);return E.fromEquirectangularTexture($,K),J.set(K,E),K.addEventListener("dispose",H),M(E.texture,K.mapping)}else return null}}return K}function H(K){let w=K.target;w.removeEventListener("dispose",H);let W=J.get(w);if(W!==void 0)J.delete(w),W.dispose()}function k(){J=new WeakMap}return{get:Q,dispose:k}}var x8=4,rM=[0.125,0.215,0.35,0.446,0.526,0.582],W8=20,y7=new O6,aM=new e0,j7=null,v7=0,b7=0,p7=!1,w8=(1+Math.sqrt(5))/2,p8=1/w8,tM=[new A(-w8,p8,0),new A(w8,p8,0),new A(-p8,0,w8),new A(p8,0,w8),new A(0,w8,-p8),new A(0,w8,p8),new A(-1,1,-1),new A(1,1,-1),new A(-1,1,1),new A(1,1,1)],dw=new A;class g7{constructor($){this._renderer=$,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene($,J=0,M=0.1,Q=100,H={}){let{size:k=256,position:K=dw}=H;j7=this._renderer.getRenderTarget(),v7=this._renderer.getActiveCubeFace(),b7=this._renderer.getActiveMipmapLevel(),p7=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(k);let w=this._allocateTargets();if(w.depthBuffer=!0,this._sceneToCubeUV($,M,Q,w,K),J>0)this._blur(w,0,0,J);return this._applyPMREM(w),this._cleanup(w),w}fromEquirectangular($,J=null){return this._fromTexture($,J)}fromCubemap($,J=null){return this._fromTexture($,J)}compileCubemapShader(){if(this._cubemapMaterial===null)this._cubemapMaterial=JQ(),this._compileMaterial(this._cubemapMaterial)}compileEquirectangularShader(){if(this._equirectMaterial===null)this._equirectMaterial=$Q(),this._compileMaterial(this._equirectMaterial)}dispose(){if(this._dispose(),this._cubemapMaterial!==null)this._cubemapMaterial.dispose();if(this._equirectMaterial!==null)this._equirectMaterial.dispose()}_setSize($){this._lodMax=Math.floor(Math.log2($)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){if(this._blurMaterial!==null)this._blurMaterial.dispose();if(this._pingPongRenderTarget!==null)this._pingPongRenderTarget.dispose();for(let $=0;$<this._lodPlanes.length;$++)this._lodPlanes[$].dispose()}_cleanup($){this._renderer.setRenderTarget(j7,v7,b7),this._renderer.xr.enabled=p7,$.scissorTest=!1,T$($,0,0,$.width,$.height)}_fromTexture($,J){if($.mapping===S8||$.mapping===a5)this._setSize($.image.length===0?16:$.image[0].width||$.image[0].image.width);else this._setSize($.image.width/4);j7=this._renderer.getRenderTarget(),v7=this._renderer.getActiveCubeFace(),b7=this._renderer.getActiveMipmapLevel(),p7=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;let M=J||this._allocateTargets();return this._textureToCubeUV($,M),this._applyPMREM(M),this._cleanup(M),M}_allocateTargets(){let $=3*Math.max(this._cubeSize,112),J=4*this._cubeSize,M={magFilter:t5,minFilter:t5,generateMipmaps:!1,type:R6,format:J5,colorSpace:Y6,depthBuffer:!1},Q=eM($,J,M);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==$||this._pingPongRenderTarget.height!==J){if(this._pingPongRenderTarget!==null)this._dispose();this._pingPongRenderTarget=eM($,J,M);let{_lodMax:H}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=mw(H)),this._blurMaterial=uw(H,$,J)}return Q}_compileMaterial($){let J=new j1(this._lodPlanes[0],$);this._renderer.compile(J,y7)}_sceneToCubeUV($,J,M,Q,H){let w=new L1(90,1,J,M),W=[1,-1,1,1,1,1],E=[1,1,1,-1,-1,-1],R=this._renderer,Z=R.autoClear,U=R.toneMapping;if(R.getClearColor(aM),R.toneMapping=I5,R.autoClear=!1,R.state.buffers.depth.getReversed())R.setRenderTarget(Q),R.clearDepth(),R.setRenderTarget(null);let G=new L$({name:"PMREM.Background",side:c1,depthWrite:!1,depthTest:!1}),q=new j1(new j8,G),Y=!1,N=$.background;if(N){if(N.isColor)G.color.copy(N),$.background=null,Y=!0}else G.color.copy(aM),Y=!0;for(let V=0;V<6;V++){let D=V%3;if(D===0)w.up.set(0,W[V],0),w.position.set(H.x,H.y,H.z),w.lookAt(H.x+E[V],H.y,H.z);else if(D===1)w.up.set(0,0,W[V]),w.position.set(H.x,H.y,H.z),w.lookAt(H.x,H.y+E[V],H.z);else w.up.set(0,W[V],0),w.position.set(H.x,H.y,H.z),w.lookAt(H.x,H.y,H.z+E[V]);let P=this._cubeSize;if(T$(Q,D*P,V>2?P:0,P,P),R.setRenderTarget(Q),Y)R.render(q,w);R.render($,w)}q.geometry.dispose(),q.material.dispose(),R.toneMapping=U,R.autoClear=Z,$.background=N}_textureToCubeUV($,J){let M=this._renderer,Q=$.mapping===S8||$.mapping===a5;if(Q){if(this._cubemapMaterial===null)this._cubemapMaterial=JQ();this._cubemapMaterial.uniforms.flipEnvMap.value=$.isRenderTargetTexture===!1?-1:1}else if(this._equirectMaterial===null)this._equirectMaterial=$Q();let H=Q?this._cubemapMaterial:this._equirectMaterial,k=new j1(this._lodPlanes[0],H),K=H.uniforms;K.envMap.value=$;let w=this._cubeSize;T$(J,0,0,3*w,2*w),M.setRenderTarget(J),M.render(k,y7)}_applyPMREM($){let J=this._renderer,M=J.autoClear;J.autoClear=!1;let Q=this._lodPlanes.length;for(let H=1;H<Q;H++){let k=Math.sqrt(this._sigmas[H]*this._sigmas[H]-this._sigmas[H-1]*this._sigmas[H-1]),K=tM[(Q-H-1)%tM.length];this._blur($,H-1,H,k,K)}J.autoClear=M}_blur($,J,M,Q,H){let k=this._pingPongRenderTarget;this._halfBlur($,k,J,M,Q,"latitudinal",H),this._halfBlur(k,$,M,M,Q,"longitudinal",H)}_halfBlur($,J,M,Q,H,k,K){let w=this._renderer,W=this._blurMaterial;if(k!=="latitudinal"&&k!=="longitudinal")console.error("blur direction must be either latitudinal or longitudinal!");let E=3,R=new j1(this._lodPlanes[Q],W),Z=W.uniforms,U=this._sizeLods[M]-1,X=isFinite(H)?Math.PI/(2*U):2*Math.PI/(2*W8-1),G=H/X,q=isFinite(H)?1+Math.floor(E*G):W8;if(q>W8)console.warn(`sigmaRadians, ${H}, is too large and will clip, as it requested ${q} samples when the maximum is set to ${W8}`);let Y=[],N=0;for(let B=0;B<W8;++B){let S=B/G,b=Math.exp(-S*S/2);if(Y.push(b),B===0)N+=b;else if(B<q)N+=2*b}for(let B=0;B<Y.length;B++)Y[B]=Y[B]/N;if(Z.envMap.value=$.texture,Z.samples.value=q,Z.weights.value=Y,Z.latitudinal.value=k==="latitudinal",K)Z.poleAxis.value=K;let{_lodMax:V}=this;Z.dTheta.value=X,Z.mipInt.value=V-M;let D=this._sizeLods[Q],P=3*D*(Q>V-x8?Q-V+x8:0),h=4*(this._cubeSize-D);T$(J,P,h,3*D,2*D),w.setRenderTarget(J),w.render(R,y7)}}function mw($){let J=[],M=[],Q=[],H=$,k=$-x8+1+rM.length;for(let K=0;K<k;K++){let w=Math.pow(2,H);M.push(w);let W=1/w;if(K>$-x8)W=rM[K-$+x8-1];else if(K===0)W=0;Q.push(W);let E=1/(w-2),R=-E,Z=1+E,U=[R,R,Z,R,Z,Z,R,R,Z,Z,R,Z],X=6,G=6,q=3,Y=2,N=1,V=new Float32Array(q*G*X),D=new Float32Array(Y*G*X),P=new Float32Array(N*G*X);for(let B=0;B<X;B++){let S=B%3*2/3-1,b=B>2?0:-1,z=[S,b,0,S+0.6666666666666666,b,0,S+0.6666666666666666,b+1,0,S,b,0,S+0.6666666666666666,b+1,0,S,b+1,0];V.set(z,q*G*B),D.set(U,Y*G*B);let O=[B,B,B,B,B,B];P.set(O,N*G*B)}let h=new o1;if(h.setAttribute("position",new N1(V,q)),h.setAttribute("uv",new N1(D,Y)),h.setAttribute("faceIndex",new N1(P,N)),J.push(h),H>x8)H--}return{lodPlanes:J,sizeLods:M,sigmas:Q}}function eM($,J,M){let Q=new M5($,J,M);return Q.texture.mapping=W6,Q.texture.name="PMREM.cubeUv",Q.scissorTest=!0,Q}function T$($,J,M,Q,H){$.viewport.set(J,M,Q,H),$.scissor.set(J,M,Q,H)}function uw($,J,M){let Q=new Float32Array(W8),H=new A(0,1,0);return new Q5({name:"SphericalGaussianBlur",defines:{n:W8,CUBEUV_TEXEL_WIDTH:1/J,CUBEUV_TEXEL_HEIGHT:1/M,CUBEUV_MAX_MIP:`${$}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:Q},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:H}},vertexShader:d7(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:v5,depthTest:!1,depthWrite:!1})}function $Q(){return new Q5({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:d7(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:v5,depthTest:!1,depthWrite:!1})}function JQ(){return new Q5({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:d7(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:v5,depthTest:!1,depthWrite:!1})}function d7(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function cw($){let J=new WeakMap,M=null;function Q(w){if(w&&w.isTexture){let W=w.mapping,E=W===Z$||W===R$,R=W===S8||W===a5;if(E||R){let Z=J.get(w),U=Z!==void 0?Z.texture.pmremVersion:0;if(w.isRenderTargetTexture&&w.pmremVersion!==U){if(M===null)M=new g7($);return Z=E?M.fromEquirectangular(w,Z):M.fromCubemap(w,Z),Z.texture.pmremVersion=w.pmremVersion,J.set(w,Z),Z.texture}else if(Z!==void 0)return Z.texture;else{let X=w.image;if(E&&X&&X.height>0||R&&X&&H(X)){if(M===null)M=new g7($);return Z=E?M.fromEquirectangular(w):M.fromCubemap(w),Z.texture.pmremVersion=w.pmremVersion,J.set(w,Z),w.addEventListener("dispose",k),Z.texture}else return null}}}return w}function H(w){let W=0,E=6;for(let R=0;R<E;R++)if(w[R]!==void 0)W++;return W===E}function k(w){let W=w.target;W.removeEventListener("dispose",k);let E=J.get(W);if(E!==void 0)J.delete(W),E.dispose()}function K(){if(J=new WeakMap,M!==null)M.dispose(),M=null}return{get:Q,dispose:K}}function nw($){let J={};function M(Q){if(J[Q]!==void 0)return J[Q];let H;switch(Q){case"WEBGL_depth_texture":H=$.getExtension("WEBGL_depth_texture")||$.getExtension("MOZ_WEBGL_depth_texture")||$.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":H=$.getExtension("EXT_texture_filter_anisotropic")||$.getExtension("MOZ_EXT_texture_filter_anisotropic")||$.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":H=$.getExtension("WEBGL_compressed_texture_s3tc")||$.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||$.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":H=$.getExtension("WEBGL_compressed_texture_pvrtc")||$.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:H=$.getExtension(Q)}return J[Q]=H,H}return{has:function(Q){return M(Q)!==null},init:function(){M("EXT_color_buffer_float"),M("WEBGL_clip_cull_distance"),M("OES_texture_float_linear"),M("EXT_color_buffer_half_float"),M("WEBGL_multisampled_render_to_texture"),M("WEBGL_render_shared_exponent")},get:function(Q){let H=M(Q);if(H===null)r5("THREE.WebGLRenderer: "+Q+" extension not supported.");return H}}}function sw($,J,M,Q){let H={},k=new WeakMap;function K(Z){let U=Z.target;if(U.index!==null)J.remove(U.index);for(let G in U.attributes)J.remove(U.attributes[G]);U.removeEventListener("dispose",K),delete H[U.id];let X=k.get(U);if(X)J.remove(X),k.delete(U);if(Q.releaseStatesOfGeometry(U),U.isInstancedBufferGeometry===!0)delete U._maxInstanceCount;M.memory.geometries--}function w(Z,U){if(H[U.id]===!0)return U;return U.addEventListener("dispose",K),H[U.id]=!0,M.memory.geometries++,U}function W(Z){let U=Z.attributes;for(let X in U)J.update(U[X],$.ARRAY_BUFFER)}function E(Z){let U=[],X=Z.index,G=Z.attributes.position,q=0;if(X!==null){let V=X.array;q=X.version;for(let D=0,P=V.length;D<P;D+=3){let h=V[D+0],B=V[D+1],S=V[D+2];U.push(h,B,B,S,S,h)}}else if(G!==void 0){let V=G.array;q=G.version;for(let D=0,P=V.length/3-1;D<P;D+=3){let h=D+0,B=D+1,S=D+2;U.push(h,B,B,S,S,h)}}else return;let Y=new((R7(U))?z$:P$)(U,1);Y.version=q;let N=k.get(Z);if(N)J.remove(N);k.set(Z,Y)}function R(Z){let U=k.get(Z);if(U){let X=Z.index;if(X!==null){if(U.version<X.version)E(Z)}}else E(Z);return k.get(Z)}return{get:w,update:W,getWireframeAttribute:R}}function ow($,J,M){let Q;function H(U){Q=U}let k,K;function w(U){k=U.type,K=U.bytesPerElement}function W(U,X){$.drawElements(Q,X,k,U*K),M.update(X,Q,1)}function E(U,X,G){if(G===0)return;$.drawElementsInstanced(Q,X,k,U*K,G),M.update(X,Q,G)}function R(U,X,G){if(G===0)return;J.get("WEBGL_multi_draw").multiDrawElementsWEBGL(Q,X,0,k,U,0,G);let Y=0;for(let N=0;N<G;N++)Y+=X[N];M.update(Y,Q,1)}function Z(U,X,G,q){if(G===0)return;let Y=J.get("WEBGL_multi_draw");if(Y===null)for(let N=0;N<U.length;N++)E(U[N]/K,X[N],q[N]);else{Y.multiDrawElementsInstancedWEBGL(Q,X,0,k,U,0,q,0,G);let N=0;for(let V=0;V<G;V++)N+=X[V]*q[V];M.update(N,Q,1)}}this.setMode=H,this.setIndex=w,this.render=W,this.renderInstances=E,this.renderMultiDraw=R,this.renderMultiDrawInstances=Z}function iw($){let J={geometries:0,textures:0},M={frame:0,calls:0,triangles:0,points:0,lines:0};function Q(k,K,w){switch(M.calls++,K){case $.TRIANGLES:M.triangles+=w*(k/3);break;case $.LINES:M.lines+=w*(k/2);break;case $.LINE_STRIP:M.lines+=w*(k-1);break;case $.LINE_LOOP:M.lines+=w*k;break;case $.POINTS:M.points+=w*k;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",K);break}}function H(){M.calls=0,M.triangles=0,M.points=0,M.lines=0}return{memory:J,render:M,programs:null,autoReset:!0,reset:H,update:Q}}function rw($,J,M){let Q=new WeakMap,H=new U1;function k(K,w,W){let E=K.morphTargetInfluences,R=w.morphAttributes.position||w.morphAttributes.normal||w.morphAttributes.color,Z=R!==void 0?R.length:0,U=Q.get(w);if(U===void 0||U.count!==Z){let z=function(){S.dispose(),Q.delete(w),w.removeEventListener("dispose",z)};if(U!==void 0)U.texture.dispose();let X=w.morphAttributes.position!==void 0,G=w.morphAttributes.normal!==void 0,q=w.morphAttributes.color!==void 0,Y=w.morphAttributes.position||[],N=w.morphAttributes.normal||[],V=w.morphAttributes.color||[],D=0;if(X===!0)D=1;if(G===!0)D=2;if(q===!0)D=3;let P=w.attributes.position.count*D,h=1;if(P>J.maxTextureSize)h=Math.ceil(P/J.maxTextureSize),P=J.maxTextureSize;let B=new Float32Array(P*h*4*Z),S=new O$(B,P,h,Z);S.type=b5,S.needsUpdate=!0;let b=D*4;for(let O=0;O<Z;O++){let f=Y[O],g=N[O],p=V[O],u=P*h*4*O;for(let t=0;t<f.count;t++){let m=t*b;if(X===!0)H.fromBufferAttribute(f,t),B[u+m+0]=H.x,B[u+m+1]=H.y,B[u+m+2]=H.z,B[u+m+3]=0;if(G===!0)H.fromBufferAttribute(g,t),B[u+m+4]=H.x,B[u+m+5]=H.y,B[u+m+6]=H.z,B[u+m+7]=0;if(q===!0)H.fromBufferAttribute(p,t),B[u+m+8]=H.x,B[u+m+9]=H.y,B[u+m+10]=H.z,B[u+m+11]=p.itemSize===4?H.w:1}}U={count:Z,texture:S,size:new J1(P,h)},Q.set(w,U),w.addEventListener("dispose",z)}if(K.isInstancedMesh===!0&&K.morphTexture!==null)W.getUniforms().setValue($,"morphTexture",K.morphTexture,M);else{let X=0;for(let q=0;q<E.length;q++)X+=E[q];let G=w.morphTargetsRelative?1:1-X;W.getUniforms().setValue($,"morphTargetBaseInfluence",G),W.getUniforms().setValue($,"morphTargetInfluences",E)}W.getUniforms().setValue($,"morphTargetsTexture",U.texture,M),W.getUniforms().setValue($,"morphTargetsTextureSize",U.size)}return{update:k}}function aw($,J,M,Q){let H=new WeakMap;function k(W){let E=Q.render.frame,R=W.geometry,Z=J.get(W,R);if(H.get(Z)!==E)J.update(Z),H.set(Z,E);if(W.isInstancedMesh){if(W.hasEventListener("dispose",w)===!1)W.addEventListener("dispose",w);if(H.get(W)!==E){if(M.update(W.instanceMatrix,$.ARRAY_BUFFER),W.instanceColor!==null)M.update(W.instanceColor,$.ARRAY_BUFFER);H.set(W,E)}}if(W.isSkinnedMesh){let U=W.skeleton;if(H.get(U)!==E)U.update(),H.set(U,E)}return Z}function K(){H=new WeakMap}function w(W){let E=W.target;if(E.removeEventListener("dispose",w),M.remove(E.instanceMatrix),E.instanceColor!==null)M.remove(E.instanceColor)}return{update:k,dispose:K}}var FQ=new T1,MQ=new v8(1,1),LQ=new O$,PQ=new N7,zQ=new B$,QQ=[],HQ=[],kQ=new Float32Array(16),KQ=new Float32Array(9),wQ=new Float32Array(4);function g8($,J,M){let Q=$[0];if(Q<=0||Q>0)return $;let H=J*M,k=QQ[H];if(k===void 0)k=new Float32Array(H),QQ[H]=k;if(J!==0){Q.toArray(k,0);for(let K=1,w=0;K!==J;++K)w+=M,$[K].toArray(k,w)}return k}function G1($,J){if($.length!==J.length)return!1;for(let M=0,Q=$.length;M<Q;M++)if($[M]!==J[M])return!1;return!0}function D1($,J){for(let M=0,Q=J.length;M<Q;M++)$[M]=J[M]}function f$($,J){let M=HQ[J];if(M===void 0)M=new Int32Array(J),HQ[J]=M;for(let Q=0;Q!==J;++Q)M[Q]=$.allocateTextureUnit();return M}function tw($,J){let M=this.cache;if(M[0]===J)return;$.uniform1f(this.addr,J),M[0]=J}function ew($,J){let M=this.cache;if(J.x!==void 0){if(M[0]!==J.x||M[1]!==J.y)$.uniform2f(this.addr,J.x,J.y),M[0]=J.x,M[1]=J.y}else{if(G1(M,J))return;$.uniform2fv(this.addr,J),D1(M,J)}}function $W($,J){let M=this.cache;if(J.x!==void 0){if(M[0]!==J.x||M[1]!==J.y||M[2]!==J.z)$.uniform3f(this.addr,J.x,J.y,J.z),M[0]=J.x,M[1]=J.y,M[2]=J.z}else if(J.r!==void 0){if(M[0]!==J.r||M[1]!==J.g||M[2]!==J.b)$.uniform3f(this.addr,J.r,J.g,J.b),M[0]=J.r,M[1]=J.g,M[2]=J.b}else{if(G1(M,J))return;$.uniform3fv(this.addr,J),D1(M,J)}}function JW($,J){let M=this.cache;if(J.x!==void 0){if(M[0]!==J.x||M[1]!==J.y||M[2]!==J.z||M[3]!==J.w)$.uniform4f(this.addr,J.x,J.y,J.z,J.w),M[0]=J.x,M[1]=J.y,M[2]=J.z,M[3]=J.w}else{if(G1(M,J))return;$.uniform4fv(this.addr,J),D1(M,J)}}function MW($,J){let M=this.cache,Q=J.elements;if(Q===void 0){if(G1(M,J))return;$.uniformMatrix2fv(this.addr,!1,J),D1(M,J)}else{if(G1(M,Q))return;wQ.set(Q),$.uniformMatrix2fv(this.addr,!1,wQ),D1(M,Q)}}function QW($,J){let M=this.cache,Q=J.elements;if(Q===void 0){if(G1(M,J))return;$.uniformMatrix3fv(this.addr,!1,J),D1(M,J)}else{if(G1(M,Q))return;KQ.set(Q),$.uniformMatrix3fv(this.addr,!1,KQ),D1(M,Q)}}function HW($,J){let M=this.cache,Q=J.elements;if(Q===void 0){if(G1(M,J))return;$.uniformMatrix4fv(this.addr,!1,J),D1(M,J)}else{if(G1(M,Q))return;kQ.set(Q),$.uniformMatrix4fv(this.addr,!1,kQ),D1(M,Q)}}function kW($,J){let M=this.cache;if(M[0]===J)return;$.uniform1i(this.addr,J),M[0]=J}function KW($,J){let M=this.cache;if(J.x!==void 0){if(M[0]!==J.x||M[1]!==J.y)$.uniform2i(this.addr,J.x,J.y),M[0]=J.x,M[1]=J.y}else{if(G1(M,J))return;$.uniform2iv(this.addr,J),D1(M,J)}}function wW($,J){let M=this.cache;if(J.x!==void 0){if(M[0]!==J.x||M[1]!==J.y||M[2]!==J.z)$.uniform3i(this.addr,J.x,J.y,J.z),M[0]=J.x,M[1]=J.y,M[2]=J.z}else{if(G1(M,J))return;$.uniform3iv(this.addr,J),D1(M,J)}}function WW($,J){let M=this.cache;if(J.x!==void 0){if(M[0]!==J.x||M[1]!==J.y||M[2]!==J.z||M[3]!==J.w)$.uniform4i(this.addr,J.x,J.y,J.z,J.w),M[0]=J.x,M[1]=J.y,M[2]=J.z,M[3]=J.w}else{if(G1(M,J))return;$.uniform4iv(this.addr,J),D1(M,J)}}function EW($,J){let M=this.cache;if(M[0]===J)return;$.uniform1ui(this.addr,J),M[0]=J}function ZW($,J){let M=this.cache;if(J.x!==void 0){if(M[0]!==J.x||M[1]!==J.y)$.uniform2ui(this.addr,J.x,J.y),M[0]=J.x,M[1]=J.y}else{if(G1(M,J))return;$.uniform2uiv(this.addr,J),D1(M,J)}}function RW($,J){let M=this.cache;if(J.x!==void 0){if(M[0]!==J.x||M[1]!==J.y||M[2]!==J.z)$.uniform3ui(this.addr,J.x,J.y,J.z),M[0]=J.x,M[1]=J.y,M[2]=J.z}else{if(G1(M,J))return;$.uniform3uiv(this.addr,J),D1(M,J)}}function UW($,J){let M=this.cache;if(J.x!==void 0){if(M[0]!==J.x||M[1]!==J.y||M[2]!==J.z||M[3]!==J.w)$.uniform4ui(this.addr,J.x,J.y,J.z,J.w),M[0]=J.x,M[1]=J.y,M[2]=J.z,M[3]=J.w}else{if(G1(M,J))return;$.uniform4uiv(this.addr,J),D1(M,J)}}function YW($,J,M){let Q=this.cache,H=M.allocateTextureUnit();if(Q[0]!==H)$.uniform1i(this.addr,H),Q[0]=H;let k;if(this.type===$.SAMPLER_2D_SHADOW)MQ.compareFunction=W7,k=MQ;else k=FQ;M.setTexture2D(J||k,H)}function NW($,J,M){let Q=this.cache,H=M.allocateTextureUnit();if(Q[0]!==H)$.uniform1i(this.addr,H),Q[0]=H;M.setTexture3D(J||PQ,H)}function XW($,J,M){let Q=this.cache,H=M.allocateTextureUnit();if(Q[0]!==H)$.uniform1i(this.addr,H),Q[0]=H;M.setTextureCube(J||zQ,H)}function GW($,J,M){let Q=this.cache,H=M.allocateTextureUnit();if(Q[0]!==H)$.uniform1i(this.addr,H),Q[0]=H;M.setTexture2DArray(J||LQ,H)}function DW($){switch($){case 5126:return tw;case 35664:return ew;case 35665:return $W;case 35666:return JW;case 35674:return MW;case 35675:return QW;case 35676:return HW;case 5124:case 35670:return kW;case 35667:case 35671:return KW;case 35668:case 35672:return wW;case 35669:case 35673:return WW;case 5125:return EW;case 36294:return ZW;case 36295:return RW;case 36296:return UW;case 35678:case 36198:case 36298:case 36306:case 35682:return YW;case 35679:case 36299:case 36307:return NW;case 35680:case 36300:case 36308:case 36293:return XW;case 36289:case 36303:case 36311:case 36292:return GW}}function qW($,J){$.uniform1fv(this.addr,J)}function OW($,J){let M=g8(J,this.size,2);$.uniform2fv(this.addr,M)}function FW($,J){let M=g8(J,this.size,3);$.uniform3fv(this.addr,M)}function LW($,J){let M=g8(J,this.size,4);$.uniform4fv(this.addr,M)}function PW($,J){let M=g8(J,this.size,4);$.uniformMatrix2fv(this.addr,!1,M)}function zW($,J){let M=g8(J,this.size,9);$.uniformMatrix3fv(this.addr,!1,M)}function VW($,J){let M=g8(J,this.size,16);$.uniformMatrix4fv(this.addr,!1,M)}function BW($,J){$.uniform1iv(this.addr,J)}function IW($,J){$.uniform2iv(this.addr,J)}function CW($,J){$.uniform3iv(this.addr,J)}function _W($,J){$.uniform4iv(this.addr,J)}function AW($,J){$.uniform1uiv(this.addr,J)}function SW($,J){$.uniform2uiv(this.addr,J)}function TW($,J){$.uniform3uiv(this.addr,J)}function hW($,J){$.uniform4uiv(this.addr,J)}function fW($,J,M){let Q=this.cache,H=J.length,k=f$(M,H);if(!G1(Q,k))$.uniform1iv(this.addr,k),D1(Q,k);for(let K=0;K!==H;++K)M.setTexture2D(J[K]||FQ,k[K])}function yW($,J,M){let Q=this.cache,H=J.length,k=f$(M,H);if(!G1(Q,k))$.uniform1iv(this.addr,k),D1(Q,k);for(let K=0;K!==H;++K)M.setTexture3D(J[K]||PQ,k[K])}function jW($,J,M){let Q=this.cache,H=J.length,k=f$(M,H);if(!G1(Q,k))$.uniform1iv(this.addr,k),D1(Q,k);for(let K=0;K!==H;++K)M.setTextureCube(J[K]||zQ,k[K])}function vW($,J,M){let Q=this.cache,H=J.length,k=f$(M,H);if(!G1(Q,k))$.uniform1iv(this.addr,k),D1(Q,k);for(let K=0;K!==H;++K)M.setTexture2DArray(J[K]||LQ,k[K])}function bW($){switch($){case 5126:return qW;case 35664:return OW;case 35665:return FW;case 35666:return LW;case 35674:return PW;case 35675:return zW;case 35676:return VW;case 5124:case 35670:return BW;case 35667:case 35671:return IW;case 35668:case 35672:return CW;case 35669:case 35673:return _W;case 5125:return AW;case 36294:return SW;case 36295:return TW;case 36296:return hW;case 35678:case 36198:case 36298:case 36306:case 35682:return fW;case 35679:case 36299:case 36307:return yW;case 35680:case 36300:case 36308:case 36293:return jW;case 36289:case 36303:case 36311:case 36292:return vW}}class VQ{constructor($,J,M){this.id=$,this.addr=M,this.cache=[],this.type=J.type,this.setValue=DW(J.type)}}class BQ{constructor($,J,M){this.id=$,this.addr=M,this.cache=[],this.type=J.type,this.size=J.size,this.setValue=bW(J.type)}}class IQ{constructor($){this.id=$,this.seq=[],this.map={}}setValue($,J,M){let Q=this.seq;for(let H=0,k=Q.length;H!==k;++H){let K=Q[H];K.setValue($,J[K.id],M)}}}var x7=/(\w+)(\])?(\[|\.)?/g;function WQ($,J){$.seq.push(J),$.map[J.id]=J}function pW($,J,M){let Q=$.name,H=Q.length;x7.lastIndex=0;while(!0){let k=x7.exec(Q),K=x7.lastIndex,w=k[1],W=k[2]==="]",E=k[3];if(W)w=w|0;if(E===void 0||E==="["&&K+2===H){WQ(M,E===void 0?new VQ(w,$,J):new BQ(w,$,J));break}else{let Z=M.map[w];if(Z===void 0)Z=new IQ(w),WQ(M,Z);M=Z}}}class L6{constructor($,J){this.seq=[],this.map={};let M=$.getProgramParameter(J,$.ACTIVE_UNIFORMS);for(let Q=0;Q<M;++Q){let H=$.getActiveUniform(J,Q),k=$.getUniformLocation(J,H.name);pW(H,k,this)}}setValue($,J,M,Q){let H=this.map[J];if(H!==void 0)H.setValue($,M,Q)}setOptional($,J,M){let Q=J[M];if(Q!==void 0)this.setValue($,M,Q)}static upload($,J,M,Q){for(let H=0,k=J.length;H!==k;++H){let K=J[H],w=M[K.id];if(w.needsUpdate!==!1)K.setValue($,w.value,Q)}}static seqWithValue($,J){let M=[];for(let Q=0,H=$.length;Q!==H;++Q){let k=$[Q];if(k.id in J)M.push(k)}return M}}function EQ($,J,M){let Q=$.createShader(J);return $.shaderSource(Q,M),$.compileShader(Q),Q}var xW=37297,gW=0;function lW($,J){let M=$.split(`
`),Q=[],H=Math.max(J-6,0),k=Math.min(J+6,M.length);for(let K=H;K<k;K++){let w=K+1;Q.push(`${w===J?">":" "} ${w}: ${M[K]}`)}return Q.join(`
`)}var ZQ=new p0;function dW($){r0._getMatrix(ZQ,r0.workingColorSpace,$);let J=`mat3( ${ZQ.elements.map((M)=>M.toFixed(4))} )`;switch(r0.getTransfer($)){case w7:return[J,"LinearTransferOETF"];case K1:return[J,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",$),[J,"LinearTransferOETF"]}}function RQ($,J,M){let Q=$.getShaderParameter(J,$.COMPILE_STATUS),k=($.getShaderInfoLog(J)||"").trim();if(Q&&k==="")return"";let K=/ERROR: 0:(\d+)/.exec(k);if(K){let w=parseInt(K[1]);return M.toUpperCase()+`

`+k+`

`+lW($.getShaderSource(J),w)}else return k}function mW($,J){let M=dW(J);return[`vec4 ${$}( vec4 value ) {`,`	return ${M[1]}( vec4( value.rgb * ${M[0]}, value.a ) );`,"}"].join(`
`)}function uW($,J){let M;switch(J){case NM:M="Linear";break;case XM:M="Reinhard";break;case GM:M="Cineon";break;case DM:M="ACESFilmic";break;case OM:M="AgX";break;case FM:M="Neutral";break;case qM:M="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",J),M="Linear"}return"vec3 "+$+"( vec3 color ) { return "+M+"ToneMapping( color ); }"}var h$=new A;function cW(){r0.getLuminanceCoefficients(h$);let $=h$.x.toFixed(4),J=h$.y.toFixed(4),M=h$.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${$}, ${J}, ${M} );`,"\treturn dot( weights, rgb );","}"].join(`
`)}function nW($){return[$.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",$.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(F6).join(`
`)}function sW($){let J=[];for(let M in $){let Q=$[M];if(Q===!1)continue;J.push("#define "+M+" "+Q)}return J.join(`
`)}function oW($,J){let M={},Q=$.getProgramParameter(J,$.ACTIVE_ATTRIBUTES);for(let H=0;H<Q;H++){let k=$.getActiveAttrib(J,H),K=k.name,w=1;if(k.type===$.FLOAT_MAT2)w=2;if(k.type===$.FLOAT_MAT3)w=3;if(k.type===$.FLOAT_MAT4)w=4;M[K]={type:k.type,location:$.getAttribLocation(J,K),locationSize:w}}return M}function F6($){return $!==""}function UQ($,J){let M=J.numSpotLightShadows+J.numSpotLightMaps-J.numSpotLightShadowsWithMaps;return $.replace(/NUM_DIR_LIGHTS/g,J.numDirLights).replace(/NUM_SPOT_LIGHTS/g,J.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,J.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,M).replace(/NUM_RECT_AREA_LIGHTS/g,J.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,J.numPointLights).replace(/NUM_HEMI_LIGHTS/g,J.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,J.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,J.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,J.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,J.numPointLightShadows)}function YQ($,J){return $.replace(/NUM_CLIPPING_PLANES/g,J.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,J.numClippingPlanes-J.numClipIntersection)}var iW=/^[ \t]*#include +<([\w\d./]+)>/gm;function l7($){return $.replace(iW,aW)}var rW=new Map;function aW($,J){let M=g0[J];if(M===void 0){let Q=rW.get(J);if(Q!==void 0)M=g0[Q],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',J,Q);else throw Error("Can not resolve #include <"+J+">")}return l7(M)}var tW=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function NQ($){return $.replace(tW,eW)}function eW($,J,M,Q){let H="";for(let k=parseInt(J);k<parseInt(M);k++)H+=Q.replace(/\[\s*i\s*\]/g,"[ "+k+" ]").replace(/UNROLLED_LOOP_INDEX/g,k);return H}function XQ($){let J=`precision ${$.precision} float;
	precision ${$.precision} int;
	precision ${$.precision} sampler2D;
	precision ${$.precision} samplerCube;
	precision ${$.precision} sampler3D;
	precision ${$.precision} sampler2DArray;
	precision ${$.precision} sampler2DShadow;
	precision ${$.precision} samplerCubeShadow;
	precision ${$.precision} sampler2DArrayShadow;
	precision ${$.precision} isampler2D;
	precision ${$.precision} isampler3D;
	precision ${$.precision} isamplerCube;
	precision ${$.precision} isampler2DArray;
	precision ${$.precision} usampler2D;
	precision ${$.precision} usampler3D;
	precision ${$.precision} usamplerCube;
	precision ${$.precision} usampler2DArray;
	`;if($.precision==="highp")J+=`
#define HIGH_PRECISION`;else if($.precision==="mediump")J+=`
#define MEDIUM_PRECISION`;else if($.precision==="lowp")J+=`
#define LOW_PRECISION`;return J}function $E($){let J="SHADOWMAP_TYPE_BASIC";if($.shadowMapType===B9)J="SHADOWMAP_TYPE_PCF";else if($.shadowMapType===uJ)J="SHADOWMAP_TYPE_PCF_SOFT";else if($.shadowMapType===U5)J="SHADOWMAP_TYPE_VSM";return J}function JE($){let J="ENVMAP_TYPE_CUBE";if($.envMap)switch($.envMapMode){case S8:case a5:J="ENVMAP_TYPE_CUBE";break;case W6:J="ENVMAP_TYPE_CUBE_UV";break}return J}function ME($){let J="ENVMAP_MODE_REFLECTION";if($.envMap)switch($.envMapMode){case a5:J="ENVMAP_MODE_REFRACTION";break}return J}function QE($){let J="ENVMAP_BLENDING_NONE";if($.envMap)switch($.combine){case RM:J="ENVMAP_BLENDING_MULTIPLY";break;case UM:J="ENVMAP_BLENDING_MIX";break;case YM:J="ENVMAP_BLENDING_ADD";break}return J}function HE($){let J=$.envMapCubeUVHeight;if(J===null)return null;let M=Math.log2(J)-2,Q=1/J;return{texelWidth:1/(3*Math.max(Math.pow(2,M),112)),texelHeight:Q,maxMip:M}}function kE($,J,M,Q){let H=$.getContext(),k=M.defines,K=M.vertexShader,w=M.fragmentShader,W=$E(M),E=JE(M),R=ME(M),Z=QE(M),U=HE(M),X=nW(M),G=sW(k),q=H.createProgram(),Y,N,V=M.glslVersion?"#version "+M.glslVersion+`
`:"";if(M.isRawShaderMaterial){if(Y=["#define SHADER_TYPE "+M.shaderType,"#define SHADER_NAME "+M.shaderName,G].filter(F6).join(`
`),Y.length>0)Y+=`
`;if(N=["#define SHADER_TYPE "+M.shaderType,"#define SHADER_NAME "+M.shaderName,G].filter(F6).join(`
`),N.length>0)N+=`
`}else Y=[XQ(M),"#define SHADER_TYPE "+M.shaderType,"#define SHADER_NAME "+M.shaderName,G,M.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",M.batching?"#define USE_BATCHING":"",M.batchingColor?"#define USE_BATCHING_COLOR":"",M.instancing?"#define USE_INSTANCING":"",M.instancingColor?"#define USE_INSTANCING_COLOR":"",M.instancingMorph?"#define USE_INSTANCING_MORPH":"",M.useFog&&M.fog?"#define USE_FOG":"",M.useFog&&M.fogExp2?"#define FOG_EXP2":"",M.map?"#define USE_MAP":"",M.envMap?"#define USE_ENVMAP":"",M.envMap?"#define "+R:"",M.lightMap?"#define USE_LIGHTMAP":"",M.aoMap?"#define USE_AOMAP":"",M.bumpMap?"#define USE_BUMPMAP":"",M.normalMap?"#define USE_NORMALMAP":"",M.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",M.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",M.displacementMap?"#define USE_DISPLACEMENTMAP":"",M.emissiveMap?"#define USE_EMISSIVEMAP":"",M.anisotropy?"#define USE_ANISOTROPY":"",M.anisotropyMap?"#define USE_ANISOTROPYMAP":"",M.clearcoatMap?"#define USE_CLEARCOATMAP":"",M.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",M.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",M.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",M.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",M.specularMap?"#define USE_SPECULARMAP":"",M.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",M.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",M.roughnessMap?"#define USE_ROUGHNESSMAP":"",M.metalnessMap?"#define USE_METALNESSMAP":"",M.alphaMap?"#define USE_ALPHAMAP":"",M.alphaHash?"#define USE_ALPHAHASH":"",M.transmission?"#define USE_TRANSMISSION":"",M.transmissionMap?"#define USE_TRANSMISSIONMAP":"",M.thicknessMap?"#define USE_THICKNESSMAP":"",M.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",M.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",M.mapUv?"#define MAP_UV "+M.mapUv:"",M.alphaMapUv?"#define ALPHAMAP_UV "+M.alphaMapUv:"",M.lightMapUv?"#define LIGHTMAP_UV "+M.lightMapUv:"",M.aoMapUv?"#define AOMAP_UV "+M.aoMapUv:"",M.emissiveMapUv?"#define EMISSIVEMAP_UV "+M.emissiveMapUv:"",M.bumpMapUv?"#define BUMPMAP_UV "+M.bumpMapUv:"",M.normalMapUv?"#define NORMALMAP_UV "+M.normalMapUv:"",M.displacementMapUv?"#define DISPLACEMENTMAP_UV "+M.displacementMapUv:"",M.metalnessMapUv?"#define METALNESSMAP_UV "+M.metalnessMapUv:"",M.roughnessMapUv?"#define ROUGHNESSMAP_UV "+M.roughnessMapUv:"",M.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+M.anisotropyMapUv:"",M.clearcoatMapUv?"#define CLEARCOATMAP_UV "+M.clearcoatMapUv:"",M.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+M.clearcoatNormalMapUv:"",M.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+M.clearcoatRoughnessMapUv:"",M.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+M.iridescenceMapUv:"",M.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+M.iridescenceThicknessMapUv:"",M.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+M.sheenColorMapUv:"",M.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+M.sheenRoughnessMapUv:"",M.specularMapUv?"#define SPECULARMAP_UV "+M.specularMapUv:"",M.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+M.specularColorMapUv:"",M.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+M.specularIntensityMapUv:"",M.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+M.transmissionMapUv:"",M.thicknessMapUv?"#define THICKNESSMAP_UV "+M.thicknessMapUv:"",M.vertexTangents&&M.flatShading===!1?"#define USE_TANGENT":"",M.vertexColors?"#define USE_COLOR":"",M.vertexAlphas?"#define USE_COLOR_ALPHA":"",M.vertexUv1s?"#define USE_UV1":"",M.vertexUv2s?"#define USE_UV2":"",M.vertexUv3s?"#define USE_UV3":"",M.pointsUvs?"#define USE_POINTS_UV":"",M.flatShading?"#define FLAT_SHADED":"",M.skinning?"#define USE_SKINNING":"",M.morphTargets?"#define USE_MORPHTARGETS":"",M.morphNormals&&M.flatShading===!1?"#define USE_MORPHNORMALS":"",M.morphColors?"#define USE_MORPHCOLORS":"",M.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+M.morphTextureStride:"",M.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+M.morphTargetsCount:"",M.doubleSided?"#define DOUBLE_SIDED":"",M.flipSided?"#define FLIP_SIDED":"",M.shadowMapEnabled?"#define USE_SHADOWMAP":"",M.shadowMapEnabled?"#define "+W:"",M.sizeAttenuation?"#define USE_SIZEATTENUATION":"",M.numLightProbes>0?"#define USE_LIGHT_PROBES":"",M.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",M.reversedDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","\tattribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","\tattribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","\tuniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","\tattribute vec2 uv1;","#endif","#ifdef USE_UV2","\tattribute vec2 uv2;","#endif","#ifdef USE_UV3","\tattribute vec2 uv3;","#endif","#ifdef USE_TANGENT","\tattribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","\tattribute vec4 color;","#elif defined( USE_COLOR )","\tattribute vec3 color;","#endif","#ifdef USE_SKINNING","\tattribute vec4 skinIndex;","\tattribute vec4 skinWeight;","#endif",`
`].filter(F6).join(`
`),N=[XQ(M),"#define SHADER_TYPE "+M.shaderType,"#define SHADER_NAME "+M.shaderName,G,M.useFog&&M.fog?"#define USE_FOG":"",M.useFog&&M.fogExp2?"#define FOG_EXP2":"",M.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",M.map?"#define USE_MAP":"",M.matcap?"#define USE_MATCAP":"",M.envMap?"#define USE_ENVMAP":"",M.envMap?"#define "+E:"",M.envMap?"#define "+R:"",M.envMap?"#define "+Z:"",U?"#define CUBEUV_TEXEL_WIDTH "+U.texelWidth:"",U?"#define CUBEUV_TEXEL_HEIGHT "+U.texelHeight:"",U?"#define CUBEUV_MAX_MIP "+U.maxMip+".0":"",M.lightMap?"#define USE_LIGHTMAP":"",M.aoMap?"#define USE_AOMAP":"",M.bumpMap?"#define USE_BUMPMAP":"",M.normalMap?"#define USE_NORMALMAP":"",M.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",M.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",M.emissiveMap?"#define USE_EMISSIVEMAP":"",M.anisotropy?"#define USE_ANISOTROPY":"",M.anisotropyMap?"#define USE_ANISOTROPYMAP":"",M.clearcoat?"#define USE_CLEARCOAT":"",M.clearcoatMap?"#define USE_CLEARCOATMAP":"",M.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",M.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",M.dispersion?"#define USE_DISPERSION":"",M.iridescence?"#define USE_IRIDESCENCE":"",M.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",M.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",M.specularMap?"#define USE_SPECULARMAP":"",M.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",M.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",M.roughnessMap?"#define USE_ROUGHNESSMAP":"",M.metalnessMap?"#define USE_METALNESSMAP":"",M.alphaMap?"#define USE_ALPHAMAP":"",M.alphaTest?"#define USE_ALPHATEST":"",M.alphaHash?"#define USE_ALPHAHASH":"",M.sheen?"#define USE_SHEEN":"",M.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",M.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",M.transmission?"#define USE_TRANSMISSION":"",M.transmissionMap?"#define USE_TRANSMISSIONMAP":"",M.thicknessMap?"#define USE_THICKNESSMAP":"",M.vertexTangents&&M.flatShading===!1?"#define USE_TANGENT":"",M.vertexColors||M.instancingColor||M.batchingColor?"#define USE_COLOR":"",M.vertexAlphas?"#define USE_COLOR_ALPHA":"",M.vertexUv1s?"#define USE_UV1":"",M.vertexUv2s?"#define USE_UV2":"",M.vertexUv3s?"#define USE_UV3":"",M.pointsUvs?"#define USE_POINTS_UV":"",M.gradientMap?"#define USE_GRADIENTMAP":"",M.flatShading?"#define FLAT_SHADED":"",M.doubleSided?"#define DOUBLE_SIDED":"",M.flipSided?"#define FLIP_SIDED":"",M.shadowMapEnabled?"#define USE_SHADOWMAP":"",M.shadowMapEnabled?"#define "+W:"",M.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",M.numLightProbes>0?"#define USE_LIGHT_PROBES":"",M.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",M.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",M.logarithmicDepthBuffer?"#define USE_LOGDEPTHBUF":"",M.reversedDepthBuffer?"#define USE_REVERSEDEPTHBUF":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",M.toneMapping!==I5?"#define TONE_MAPPING":"",M.toneMapping!==I5?g0.tonemapping_pars_fragment:"",M.toneMapping!==I5?uW("toneMapping",M.toneMapping):"",M.dithering?"#define DITHERING":"",M.opaque?"#define OPAQUE":"",g0.colorspace_pars_fragment,mW("linearToOutputTexel",M.outputColorSpace),cW(),M.useDepthPacking?"#define DEPTH_PACKING "+M.depthPacking:"",`
`].filter(F6).join(`
`);if(K=l7(K),K=UQ(K,M),K=YQ(K,M),w=l7(w),w=UQ(w,M),w=YQ(w,M),K=NQ(K),w=NQ(w),M.isRawShaderMaterial!==!0)V=`#version 300 es
`,Y=[X,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+Y,N=["#define varying in",M.glslVersion===E7?"":"layout(location = 0) out highp vec4 pc_fragColor;",M.glslVersion===E7?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+N;let D=V+Y+K,P=V+N+w,h=EQ(H,H.VERTEX_SHADER,D),B=EQ(H,H.FRAGMENT_SHADER,P);if(H.attachShader(q,h),H.attachShader(q,B),M.index0AttributeName!==void 0)H.bindAttribLocation(q,0,M.index0AttributeName);else if(M.morphTargets===!0)H.bindAttribLocation(q,0,"position");H.linkProgram(q);function S(f){if($.debug.checkShaderErrors){let g=H.getProgramInfoLog(q)||"",p=H.getShaderInfoLog(h)||"",u=H.getShaderInfoLog(B)||"",t=g.trim(),m=p.trim(),e=u.trim(),d=!0,Q0=!0;if(H.getProgramParameter(q,H.LINK_STATUS)===!1)if(d=!1,typeof $.debug.onShaderError==="function")$.debug.onShaderError(H,q,h,B);else{let w0=RQ(H,h,"vertex"),D0=RQ(H,B,"fragment");console.error("THREE.WebGLProgram: Shader Error "+H.getError()+" - VALIDATE_STATUS "+H.getProgramParameter(q,H.VALIDATE_STATUS)+`

Material Name: `+f.name+`
Material Type: `+f.type+`

Program Info Log: `+t+`
`+w0+`
`+D0)}else if(t!=="")console.warn("THREE.WebGLProgram: Program Info Log:",t);else if(m===""||e==="")Q0=!1;if(Q0)f.diagnostics={runnable:d,programLog:t,vertexShader:{log:m,prefix:Y},fragmentShader:{log:e,prefix:N}}}H.deleteShader(h),H.deleteShader(B),b=new L6(H,q),z=oW(H,q)}let b;this.getUniforms=function(){if(b===void 0)S(this);return b};let z;this.getAttributes=function(){if(z===void 0)S(this);return z};let O=M.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){if(O===!1)O=H.getProgramParameter(q,xW);return O},this.destroy=function(){Q.releaseStatesOfProgram(this),H.deleteProgram(q),this.program=void 0},this.type=M.shaderType,this.name=M.shaderName,this.id=gW++,this.cacheKey=J,this.usedTimes=1,this.program=q,this.vertexShader=h,this.fragmentShader=B,this}var KE=0;class CQ{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update($){let{vertexShader:J,fragmentShader:M}=$,Q=this._getShaderStage(J),H=this._getShaderStage(M),k=this._getShaderCacheForMaterial($);if(k.has(Q)===!1)k.add(Q),Q.usedTimes++;if(k.has(H)===!1)k.add(H),H.usedTimes++;return this}remove($){let J=this.materialCache.get($);for(let M of J)if(M.usedTimes--,M.usedTimes===0)this.shaderCache.delete(M.code);return this.materialCache.delete($),this}getVertexShaderID($){return this._getShaderStage($.vertexShader).id}getFragmentShaderID($){return this._getShaderStage($.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial($){let J=this.materialCache,M=J.get($);if(M===void 0)M=new Set,J.set($,M);return M}_getShaderStage($){let J=this.shaderCache,M=J.get($);if(M===void 0)M=new _Q($),J.set($,M);return M}}class _Q{constructor($){this.id=KE++,this.code=$,this.usedTimes=0}}function wE($,J,M,Q,H,k,K){let w=new F$,W=new CQ,E=new Set,R=[],Z=H.logarithmicDepthBuffer,U=H.vertexTextures,X=H.precision,G={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function q(z){if(E.add(z),z===0)return"uv";return`uv${z}`}function Y(z,O,f,g,p){let u=g.fog,t=p.geometry,m=z.isMeshStandardMaterial?g.environment:null,e=(z.isMeshStandardMaterial?M:J).get(z.envMap||m),d=!!e&&e.mapping===W6?e.image.height:null,Q0=G[z.type];if(z.precision!==null){if(X=H.getMaxPrecision(z.precision),X!==z.precision)console.warn("THREE.WebGLProgram.getParameters:",z.precision,"not supported, using",X,"instead.")}let w0=t.morphAttributes.position||t.morphAttributes.normal||t.morphAttributes.color,D0=w0!==void 0?w0.length:0,v0=0;if(t.morphAttributes.position!==void 0)v0=1;if(t.morphAttributes.normal!==void 0)v0=2;if(t.morphAttributes.color!==void 0)v0=3;let l0,c,R0,G0;if(Q0){let i0=X5[Q0];l0=i0.vertexShader,c=i0.fragmentShader}else l0=z.vertexShader,c=z.fragmentShader,W.update(z),R0=W.getVertexShaderID(z),G0=W.getFragmentShaderID(z);let H0=$.getRenderTarget(),E0=$.state.buffers.depth.getReversed(),T0=p.isInstancedMesh===!0,h0=p.isBatchedMesh===!0,_0=!!z.map,T=!!z.matcap,d0=!!e,F0=!!z.aoMap,x0=!!z.lightMap,q0=!!z.bumpMap,n0=!!z.normalMap,N0=!!z.displacementMap,z0=!!z.emissiveMap,a0=!!z.metalnessMap,o0=!!z.roughnessMap,M1=z.anisotropy>0,I=z.clearcoat>0,F=z.dispersion>0,v=z.iridescence>0,i=z.sheen>0,$0=z.transmission>0,s=M1&&!!z.anisotropyMap,O0=I&&!!z.clearcoatMap,Z0=I&&!!z.clearcoatNormalMap,P0=I&&!!z.clearcoatRoughnessMap,S0=v&&!!z.iridescenceMap,k0=v&&!!z.iridescenceThicknessMap,U0=i&&!!z.sheenColorMap,C0=i&&!!z.sheenRoughnessMap,I0=!!z.specularMap,_=!!z.specularColorMap,n=!!z.specularIntensityMap,C=$0&&!!z.transmissionMap,o=$0&&!!z.thicknessMap,J0=!!z.gradientMap,W0=!!z.alphaMap,M0=z.alphaTest>0,r=!!z.alphaHash,V0=!!z.extensions,b0=I5;if(z.toneMapped){if(H0===null||H0.isXRRenderTarget===!0)b0=$.toneMapping}let s0={shaderID:Q0,shaderType:z.type,shaderName:z.name,vertexShader:l0,fragmentShader:c,defines:z.defines,customVertexShaderID:R0,customFragmentShaderID:G0,isRawShaderMaterial:z.isRawShaderMaterial===!0,glslVersion:z.glslVersion,precision:X,batching:h0,batchingColor:h0&&p._colorsTexture!==null,instancing:T0,instancingColor:T0&&p.instanceColor!==null,instancingMorph:T0&&p.morphTexture!==null,supportsVertexTextures:U,outputColorSpace:H0===null?$.outputColorSpace:H0.isXRRenderTarget===!0?H0.texture.colorSpace:Y6,alphaToCoverage:!!z.alphaToCoverage,map:_0,matcap:T,envMap:d0,envMapMode:d0&&e.mapping,envMapCubeUVHeight:d,aoMap:F0,lightMap:x0,bumpMap:q0,normalMap:n0,displacementMap:U&&N0,emissiveMap:z0,normalMapObjectSpace:n0&&z.normalMapType===jM,normalMapTangentSpace:n0&&z.normalMapType===yM,metalnessMap:a0,roughnessMap:o0,anisotropy:M1,anisotropyMap:s,clearcoat:I,clearcoatMap:O0,clearcoatNormalMap:Z0,clearcoatRoughnessMap:P0,dispersion:F,iridescence:v,iridescenceMap:S0,iridescenceThicknessMap:k0,sheen:i,sheenColorMap:U0,sheenRoughnessMap:C0,specularMap:I0,specularColorMap:_,specularIntensityMap:n,transmission:$0,transmissionMap:C,thicknessMap:o,gradientMap:J0,opaque:z.transparent===!1&&z.blending===K6&&z.alphaToCoverage===!1,alphaMap:W0,alphaTest:M0,alphaHash:r,combine:z.combine,mapUv:_0&&q(z.map.channel),aoMapUv:F0&&q(z.aoMap.channel),lightMapUv:x0&&q(z.lightMap.channel),bumpMapUv:q0&&q(z.bumpMap.channel),normalMapUv:n0&&q(z.normalMap.channel),displacementMapUv:N0&&q(z.displacementMap.channel),emissiveMapUv:z0&&q(z.emissiveMap.channel),metalnessMapUv:a0&&q(z.metalnessMap.channel),roughnessMapUv:o0&&q(z.roughnessMap.channel),anisotropyMapUv:s&&q(z.anisotropyMap.channel),clearcoatMapUv:O0&&q(z.clearcoatMap.channel),clearcoatNormalMapUv:Z0&&q(z.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:P0&&q(z.clearcoatRoughnessMap.channel),iridescenceMapUv:S0&&q(z.iridescenceMap.channel),iridescenceThicknessMapUv:k0&&q(z.iridescenceThicknessMap.channel),sheenColorMapUv:U0&&q(z.sheenColorMap.channel),sheenRoughnessMapUv:C0&&q(z.sheenRoughnessMap.channel),specularMapUv:I0&&q(z.specularMap.channel),specularColorMapUv:_&&q(z.specularColorMap.channel),specularIntensityMapUv:n&&q(z.specularIntensityMap.channel),transmissionMapUv:C&&q(z.transmissionMap.channel),thicknessMapUv:o&&q(z.thicknessMap.channel),alphaMapUv:W0&&q(z.alphaMap.channel),vertexTangents:!!t.attributes.tangent&&(n0||M1),vertexColors:z.vertexColors,vertexAlphas:z.vertexColors===!0&&!!t.attributes.color&&t.attributes.color.itemSize===4,pointsUvs:p.isPoints===!0&&!!t.attributes.uv&&(_0||W0),fog:!!u,useFog:z.fog===!0,fogExp2:!!u&&u.isFogExp2,flatShading:z.flatShading===!0&&z.wireframe===!1,sizeAttenuation:z.sizeAttenuation===!0,logarithmicDepthBuffer:Z,reversedDepthBuffer:E0,skinning:p.isSkinnedMesh===!0,morphTargets:t.morphAttributes.position!==void 0,morphNormals:t.morphAttributes.normal!==void 0,morphColors:t.morphAttributes.color!==void 0,morphTargetsCount:D0,morphTextureStride:v0,numDirLights:O.directional.length,numPointLights:O.point.length,numSpotLights:O.spot.length,numSpotLightMaps:O.spotLightMap.length,numRectAreaLights:O.rectArea.length,numHemiLights:O.hemi.length,numDirLightShadows:O.directionalShadowMap.length,numPointLightShadows:O.pointShadowMap.length,numSpotLightShadows:O.spotShadowMap.length,numSpotLightShadowsWithMaps:O.numSpotLightShadowsWithMaps,numLightProbes:O.numLightProbes,numClippingPlanes:K.numPlanes,numClipIntersection:K.numIntersection,dithering:z.dithering,shadowMapEnabled:$.shadowMap.enabled&&f.length>0,shadowMapType:$.shadowMap.type,toneMapping:b0,decodeVideoTexture:_0&&z.map.isVideoTexture===!0&&r0.getTransfer(z.map.colorSpace)===K1,decodeVideoTextureEmissive:z0&&z.emissiveMap.isVideoTexture===!0&&r0.getTransfer(z.emissiveMap.colorSpace)===K1,premultipliedAlpha:z.premultipliedAlpha,doubleSided:z.side===n1,flipSided:z.side===c1,useDepthPacking:z.depthPacking>=0,depthPacking:z.depthPacking||0,index0AttributeName:z.index0AttributeName,extensionClipCullDistance:V0&&z.extensions.clipCullDistance===!0&&Q.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(V0&&z.extensions.multiDraw===!0||h0)&&Q.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:Q.has("KHR_parallel_shader_compile"),customProgramCacheKey:z.customProgramCacheKey()};return s0.vertexUv1s=E.has(1),s0.vertexUv2s=E.has(2),s0.vertexUv3s=E.has(3),E.clear(),s0}function N(z){let O=[];if(z.shaderID)O.push(z.shaderID);else O.push(z.customVertexShaderID),O.push(z.customFragmentShaderID);if(z.defines!==void 0)for(let f in z.defines)O.push(f),O.push(z.defines[f]);if(z.isRawShaderMaterial===!1)V(O,z),D(O,z),O.push($.outputColorSpace);return O.push(z.customProgramCacheKey),O.join()}function V(z,O){z.push(O.precision),z.push(O.outputColorSpace),z.push(O.envMapMode),z.push(O.envMapCubeUVHeight),z.push(O.mapUv),z.push(O.alphaMapUv),z.push(O.lightMapUv),z.push(O.aoMapUv),z.push(O.bumpMapUv),z.push(O.normalMapUv),z.push(O.displacementMapUv),z.push(O.emissiveMapUv),z.push(O.metalnessMapUv),z.push(O.roughnessMapUv),z.push(O.anisotropyMapUv),z.push(O.clearcoatMapUv),z.push(O.clearcoatNormalMapUv),z.push(O.clearcoatRoughnessMapUv),z.push(O.iridescenceMapUv),z.push(O.iridescenceThicknessMapUv),z.push(O.sheenColorMapUv),z.push(O.sheenRoughnessMapUv),z.push(O.specularMapUv),z.push(O.specularColorMapUv),z.push(O.specularIntensityMapUv),z.push(O.transmissionMapUv),z.push(O.thicknessMapUv),z.push(O.combine),z.push(O.fogExp2),z.push(O.sizeAttenuation),z.push(O.morphTargetsCount),z.push(O.morphAttributeCount),z.push(O.numDirLights),z.push(O.numPointLights),z.push(O.numSpotLights),z.push(O.numSpotLightMaps),z.push(O.numHemiLights),z.push(O.numRectAreaLights),z.push(O.numDirLightShadows),z.push(O.numPointLightShadows),z.push(O.numSpotLightShadows),z.push(O.numSpotLightShadowsWithMaps),z.push(O.numLightProbes),z.push(O.shadowMapType),z.push(O.toneMapping),z.push(O.numClippingPlanes),z.push(O.numClipIntersection),z.push(O.depthPacking)}function D(z,O){if(w.disableAll(),O.supportsVertexTextures)w.enable(0);if(O.instancing)w.enable(1);if(O.instancingColor)w.enable(2);if(O.instancingMorph)w.enable(3);if(O.matcap)w.enable(4);if(O.envMap)w.enable(5);if(O.normalMapObjectSpace)w.enable(6);if(O.normalMapTangentSpace)w.enable(7);if(O.clearcoat)w.enable(8);if(O.iridescence)w.enable(9);if(O.alphaTest)w.enable(10);if(O.vertexColors)w.enable(11);if(O.vertexAlphas)w.enable(12);if(O.vertexUv1s)w.enable(13);if(O.vertexUv2s)w.enable(14);if(O.vertexUv3s)w.enable(15);if(O.vertexTangents)w.enable(16);if(O.anisotropy)w.enable(17);if(O.alphaHash)w.enable(18);if(O.batching)w.enable(19);if(O.dispersion)w.enable(20);if(O.batchingColor)w.enable(21);if(O.gradientMap)w.enable(22);if(z.push(w.mask),w.disableAll(),O.fog)w.enable(0);if(O.useFog)w.enable(1);if(O.flatShading)w.enable(2);if(O.logarithmicDepthBuffer)w.enable(3);if(O.reversedDepthBuffer)w.enable(4);if(O.skinning)w.enable(5);if(O.morphTargets)w.enable(6);if(O.morphNormals)w.enable(7);if(O.morphColors)w.enable(8);if(O.premultipliedAlpha)w.enable(9);if(O.shadowMapEnabled)w.enable(10);if(O.doubleSided)w.enable(11);if(O.flipSided)w.enable(12);if(O.useDepthPacking)w.enable(13);if(O.dithering)w.enable(14);if(O.transmission)w.enable(15);if(O.sheen)w.enable(16);if(O.opaque)w.enable(17);if(O.pointsUvs)w.enable(18);if(O.decodeVideoTexture)w.enable(19);if(O.decodeVideoTextureEmissive)w.enable(20);if(O.alphaToCoverage)w.enable(21);z.push(w.mask)}function P(z){let O=G[z.type],f;if(O){let g=X5[O];f=sM.clone(g.uniforms)}else f=z.uniforms;return f}function h(z,O){let f;for(let g=0,p=R.length;g<p;g++){let u=R[g];if(u.cacheKey===O){f=u,++f.usedTimes;break}}if(f===void 0)f=new kE($,O,z,k),R.push(f);return f}function B(z){if(--z.usedTimes===0){let O=R.indexOf(z);R[O]=R[R.length-1],R.pop(),z.destroy()}}function S(z){W.remove(z)}function b(){W.dispose()}return{getParameters:Y,getProgramCacheKey:N,getUniforms:P,acquireProgram:h,releaseProgram:B,releaseShaderCache:S,programs:R,dispose:b}}function WE(){let $=new WeakMap;function J(K){return $.has(K)}function M(K){let w=$.get(K);if(w===void 0)w={},$.set(K,w);return w}function Q(K){$.delete(K)}function H(K,w,W){$.get(K)[w]=W}function k(){$=new WeakMap}return{has:J,get:M,remove:Q,update:H,dispose:k}}function EE($,J){if($.groupOrder!==J.groupOrder)return $.groupOrder-J.groupOrder;else if($.renderOrder!==J.renderOrder)return $.renderOrder-J.renderOrder;else if($.material.id!==J.material.id)return $.material.id-J.material.id;else if($.z!==J.z)return $.z-J.z;else return $.id-J.id}function GQ($,J){if($.groupOrder!==J.groupOrder)return $.groupOrder-J.groupOrder;else if($.renderOrder!==J.renderOrder)return $.renderOrder-J.renderOrder;else if($.z!==J.z)return J.z-$.z;else return $.id-J.id}function DQ(){let $=[],J=0,M=[],Q=[],H=[];function k(){J=0,M.length=0,Q.length=0,H.length=0}function K(Z,U,X,G,q,Y){let N=$[J];if(N===void 0)N={id:Z.id,object:Z,geometry:U,material:X,groupOrder:G,renderOrder:Z.renderOrder,z:q,group:Y},$[J]=N;else N.id=Z.id,N.object=Z,N.geometry=U,N.material=X,N.groupOrder=G,N.renderOrder=Z.renderOrder,N.z=q,N.group=Y;return J++,N}function w(Z,U,X,G,q,Y){let N=K(Z,U,X,G,q,Y);if(X.transmission>0)Q.push(N);else if(X.transparent===!0)H.push(N);else M.push(N)}function W(Z,U,X,G,q,Y){let N=K(Z,U,X,G,q,Y);if(X.transmission>0)Q.unshift(N);else if(X.transparent===!0)H.unshift(N);else M.unshift(N)}function E(Z,U){if(M.length>1)M.sort(Z||EE);if(Q.length>1)Q.sort(U||GQ);if(H.length>1)H.sort(U||GQ)}function R(){for(let Z=J,U=$.length;Z<U;Z++){let X=$[Z];if(X.id===null)break;X.id=null,X.object=null,X.geometry=null,X.material=null,X.group=null}}return{opaque:M,transmissive:Q,transparent:H,init:k,push:w,unshift:W,finish:R,sort:E}}function ZE(){let $=new WeakMap;function J(Q,H){let k=$.get(Q),K;if(k===void 0)K=new DQ,$.set(Q,[K]);else if(H>=k.length)K=new DQ,k.push(K);else K=k[H];return K}function M(){$=new WeakMap}return{get:J,dispose:M}}function RE(){let $={};return{get:function(J){if($[J.id]!==void 0)return $[J.id];let M;switch(J.type){case"DirectionalLight":M={direction:new A,color:new e0};break;case"SpotLight":M={position:new A,direction:new A,color:new e0,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":M={position:new A,color:new e0,distance:0,decay:0};break;case"HemisphereLight":M={direction:new A,skyColor:new e0,groundColor:new e0};break;case"RectAreaLight":M={color:new e0,position:new A,halfWidth:new A,halfHeight:new A};break}return $[J.id]=M,M}}}function UE(){let $={};return{get:function(J){if($[J.id]!==void 0)return $[J.id];let M;switch(J.type){case"DirectionalLight":M={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new J1};break;case"SpotLight":M={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new J1};break;case"PointLight":M={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new J1,shadowCameraNear:1,shadowCameraFar:1000};break}return $[J.id]=M,M}}}var YE=0;function NE($,J){return(J.castShadow?2:0)-($.castShadow?2:0)+(J.map?1:0)-($.map?1:0)}function XE($){let J=new RE,M=UE(),Q={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let E=0;E<9;E++)Q.probe.push(new A);let H=new A,k=new H1,K=new H1;function w(E){let R=0,Z=0,U=0;for(let z=0;z<9;z++)Q.probe[z].set(0,0,0);let X=0,G=0,q=0,Y=0,N=0,V=0,D=0,P=0,h=0,B=0,S=0;E.sort(NE);for(let z=0,O=E.length;z<O;z++){let f=E[z],g=f.color,p=f.intensity,u=f.distance,t=f.shadow&&f.shadow.map?f.shadow.map.texture:null;if(f.isAmbientLight)R+=g.r*p,Z+=g.g*p,U+=g.b*p;else if(f.isLightProbe){for(let m=0;m<9;m++)Q.probe[m].addScaledVector(f.sh.coefficients[m],p);S++}else if(f.isDirectionalLight){let m=J.get(f);if(m.color.copy(f.color).multiplyScalar(f.intensity),f.castShadow){let e=f.shadow,d=M.get(f);d.shadowIntensity=e.intensity,d.shadowBias=e.bias,d.shadowNormalBias=e.normalBias,d.shadowRadius=e.radius,d.shadowMapSize=e.mapSize,Q.directionalShadow[X]=d,Q.directionalShadowMap[X]=t,Q.directionalShadowMatrix[X]=f.shadow.matrix,V++}Q.directional[X]=m,X++}else if(f.isSpotLight){let m=J.get(f);m.position.setFromMatrixPosition(f.matrixWorld),m.color.copy(g).multiplyScalar(p),m.distance=u,m.coneCos=Math.cos(f.angle),m.penumbraCos=Math.cos(f.angle*(1-f.penumbra)),m.decay=f.decay,Q.spot[q]=m;let e=f.shadow;if(f.map){if(Q.spotLightMap[h]=f.map,h++,e.updateMatrices(f),f.castShadow)B++}if(Q.spotLightMatrix[q]=e.matrix,f.castShadow){let d=M.get(f);d.shadowIntensity=e.intensity,d.shadowBias=e.bias,d.shadowNormalBias=e.normalBias,d.shadowRadius=e.radius,d.shadowMapSize=e.mapSize,Q.spotShadow[q]=d,Q.spotShadowMap[q]=t,P++}q++}else if(f.isRectAreaLight){let m=J.get(f);m.color.copy(g).multiplyScalar(p),m.halfWidth.set(f.width*0.5,0,0),m.halfHeight.set(0,f.height*0.5,0),Q.rectArea[Y]=m,Y++}else if(f.isPointLight){let m=J.get(f);if(m.color.copy(f.color).multiplyScalar(f.intensity),m.distance=f.distance,m.decay=f.decay,f.castShadow){let e=f.shadow,d=M.get(f);d.shadowIntensity=e.intensity,d.shadowBias=e.bias,d.shadowNormalBias=e.normalBias,d.shadowRadius=e.radius,d.shadowMapSize=e.mapSize,d.shadowCameraNear=e.camera.near,d.shadowCameraFar=e.camera.far,Q.pointShadow[G]=d,Q.pointShadowMap[G]=t,Q.pointShadowMatrix[G]=f.shadow.matrix,D++}Q.point[G]=m,G++}else if(f.isHemisphereLight){let m=J.get(f);m.skyColor.copy(f.color).multiplyScalar(p),m.groundColor.copy(f.groundColor).multiplyScalar(p),Q.hemi[N]=m,N++}}if(Y>0)if($.has("OES_texture_float_linear")===!0)Q.rectAreaLTC1=Y0.LTC_FLOAT_1,Q.rectAreaLTC2=Y0.LTC_FLOAT_2;else Q.rectAreaLTC1=Y0.LTC_HALF_1,Q.rectAreaLTC2=Y0.LTC_HALF_2;Q.ambient[0]=R,Q.ambient[1]=Z,Q.ambient[2]=U;let b=Q.hash;if(b.directionalLength!==X||b.pointLength!==G||b.spotLength!==q||b.rectAreaLength!==Y||b.hemiLength!==N||b.numDirectionalShadows!==V||b.numPointShadows!==D||b.numSpotShadows!==P||b.numSpotMaps!==h||b.numLightProbes!==S)Q.directional.length=X,Q.spot.length=q,Q.rectArea.length=Y,Q.point.length=G,Q.hemi.length=N,Q.directionalShadow.length=V,Q.directionalShadowMap.length=V,Q.pointShadow.length=D,Q.pointShadowMap.length=D,Q.spotShadow.length=P,Q.spotShadowMap.length=P,Q.directionalShadowMatrix.length=V,Q.pointShadowMatrix.length=D,Q.spotLightMatrix.length=P+h-B,Q.spotLightMap.length=h,Q.numSpotLightShadowsWithMaps=B,Q.numLightProbes=S,b.directionalLength=X,b.pointLength=G,b.spotLength=q,b.rectAreaLength=Y,b.hemiLength=N,b.numDirectionalShadows=V,b.numPointShadows=D,b.numSpotShadows=P,b.numSpotMaps=h,b.numLightProbes=S,Q.version=YE++}function W(E,R){let Z=0,U=0,X=0,G=0,q=0,Y=R.matrixWorldInverse;for(let N=0,V=E.length;N<V;N++){let D=E[N];if(D.isDirectionalLight){let P=Q.directional[Z];P.direction.setFromMatrixPosition(D.matrixWorld),H.setFromMatrixPosition(D.target.matrixWorld),P.direction.sub(H),P.direction.transformDirection(Y),Z++}else if(D.isSpotLight){let P=Q.spot[X];P.position.setFromMatrixPosition(D.matrixWorld),P.position.applyMatrix4(Y),P.direction.setFromMatrixPosition(D.matrixWorld),H.setFromMatrixPosition(D.target.matrixWorld),P.direction.sub(H),P.direction.transformDirection(Y),X++}else if(D.isRectAreaLight){let P=Q.rectArea[G];P.position.setFromMatrixPosition(D.matrixWorld),P.position.applyMatrix4(Y),K.identity(),k.copy(D.matrixWorld),k.premultiply(Y),K.extractRotation(k),P.halfWidth.set(D.width*0.5,0,0),P.halfHeight.set(0,D.height*0.5,0),P.halfWidth.applyMatrix4(K),P.halfHeight.applyMatrix4(K),G++}else if(D.isPointLight){let P=Q.point[U];P.position.setFromMatrixPosition(D.matrixWorld),P.position.applyMatrix4(Y),U++}else if(D.isHemisphereLight){let P=Q.hemi[q];P.direction.setFromMatrixPosition(D.matrixWorld),P.direction.transformDirection(Y),q++}}}return{setup:w,setupView:W,state:Q}}function qQ($){let J=new XE($),M=[],Q=[];function H(R){E.camera=R,M.length=0,Q.length=0}function k(R){M.push(R)}function K(R){Q.push(R)}function w(){J.setup(M)}function W(R){J.setupView(M,R)}let E={lightsArray:M,shadowsArray:Q,camera:null,lights:J,transmissionRenderTarget:{}};return{init:H,state:E,setupLights:w,setupLightsView:W,pushLight:k,pushShadow:K}}function GE($){let J=new WeakMap;function M(H,k=0){let K=J.get(H),w;if(K===void 0)w=new qQ($),J.set(H,[w]);else if(k>=K.length)w=new qQ($),K.push(w);else w=K[k];return w}function Q(){J=new WeakMap}return{get:M,dispose:Q}}var DE=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,qE=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function OE($,J,M){let Q=new C$,H=new J1,k=new J1,K=new U1,w=new O7({depthPacking:fM}),W=new F7,E={},R=M.maxTextureSize,Z={[Y5]:c1,[c1]:Y5,[n1]:n1},U=new Q5({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new J1},radius:{value:4}},vertexShader:DE,fragmentShader:qE}),X=U.clone();X.defines.HORIZONTAL_PASS=1;let G=new o1;G.setAttribute("position",new N1(new Float32Array([-1,-1,0.5,3,-1,0.5,-1,3,0.5]),3));let q=new j1(G,U),Y=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=B9;let N=this.type;this.render=function(B,S,b){if(Y.enabled===!1)return;if(Y.autoUpdate===!1&&Y.needsUpdate===!1)return;if(B.length===0)return;let z=$.getRenderTarget(),O=$.getActiveCubeFace(),f=$.getActiveMipmapLevel(),g=$.state;if(g.setBlending(v5),g.buffers.depth.getReversed())g.buffers.color.setClear(0,0,0,0);else g.buffers.color.setClear(1,1,1,1);g.buffers.depth.setTest(!0),g.setScissorTest(!1);let p=N!==U5&&this.type===U5,u=N===U5&&this.type!==U5;for(let t=0,m=B.length;t<m;t++){let e=B[t],d=e.shadow;if(d===void 0){console.warn("THREE.WebGLShadowMap:",e,"has no shadow.");continue}if(d.autoUpdate===!1&&d.needsUpdate===!1)continue;H.copy(d.mapSize);let Q0=d.getFrameExtents();if(H.multiply(Q0),k.copy(d.mapSize),H.x>R||H.y>R){if(H.x>R)k.x=Math.floor(R/Q0.x),H.x=k.x*Q0.x,d.mapSize.x=k.x;if(H.y>R)k.y=Math.floor(R/Q0.y),H.y=k.y*Q0.y,d.mapSize.y=k.y}if(d.map===null||p===!0||u===!0){let D0=this.type!==U5?{minFilter:s1,magFilter:s1}:{};if(d.map!==null)d.map.dispose();d.map=new M5(H.x,H.y,D0),d.map.texture.name=e.name+".shadowMap",d.camera.updateProjectionMatrix()}$.setRenderTarget(d.map),$.clear();let w0=d.getViewportCount();for(let D0=0;D0<w0;D0++){let v0=d.getViewport(D0);K.set(k.x*v0.x,k.y*v0.y,k.x*v0.z,k.y*v0.w),g.viewport(K),d.updateMatrices(e,D0),Q=d.getFrustum(),P(S,b,d.camera,e,this.type)}if(d.isPointLightShadow!==!0&&this.type===U5)V(d,b);d.needsUpdate=!1}N=this.type,Y.needsUpdate=!1,$.setRenderTarget(z,O,f)};function V(B,S){let b=J.update(q);if(U.defines.VSM_SAMPLES!==B.blurSamples)U.defines.VSM_SAMPLES=B.blurSamples,X.defines.VSM_SAMPLES=B.blurSamples,U.needsUpdate=!0,X.needsUpdate=!0;if(B.mapPass===null)B.mapPass=new M5(H.x,H.y);U.uniforms.shadow_pass.value=B.map.texture,U.uniforms.resolution.value=B.mapSize,U.uniforms.radius.value=B.radius,$.setRenderTarget(B.mapPass),$.clear(),$.renderBufferDirect(S,null,b,U,q,null),X.uniforms.shadow_pass.value=B.mapPass.texture,X.uniforms.resolution.value=B.mapSize,X.uniforms.radius.value=B.radius,$.setRenderTarget(B.map),$.clear(),$.renderBufferDirect(S,null,b,X,q,null)}function D(B,S,b,z){let O=null,f=b.isPointLight===!0?B.customDistanceMaterial:B.customDepthMaterial;if(f!==void 0)O=f;else if(O=b.isPointLight===!0?W:w,$.localClippingEnabled&&S.clipShadows===!0&&Array.isArray(S.clippingPlanes)&&S.clippingPlanes.length!==0||S.displacementMap&&S.displacementScale!==0||S.alphaMap&&S.alphaTest>0||S.map&&S.alphaTest>0||S.alphaToCoverage===!0){let g=O.uuid,p=S.uuid,u=E[g];if(u===void 0)u={},E[g]=u;let t=u[p];if(t===void 0)t=O.clone(),u[p]=t,S.addEventListener("dispose",h);O=t}if(O.visible=S.visible,O.wireframe=S.wireframe,z===U5)O.side=S.shadowSide!==null?S.shadowSide:S.side;else O.side=S.shadowSide!==null?S.shadowSide:Z[S.side];if(O.alphaMap=S.alphaMap,O.alphaTest=S.alphaToCoverage===!0?0.5:S.alphaTest,O.map=S.map,O.clipShadows=S.clipShadows,O.clippingPlanes=S.clippingPlanes,O.clipIntersection=S.clipIntersection,O.displacementMap=S.displacementMap,O.displacementScale=S.displacementScale,O.displacementBias=S.displacementBias,O.wireframeLinewidth=S.wireframeLinewidth,O.linewidth=S.linewidth,b.isPointLight===!0&&O.isMeshDistanceMaterial===!0){let g=$.properties.get(O);g.light=b}return O}function P(B,S,b,z,O){if(B.visible===!1)return;if(B.layers.test(S.layers)&&(B.isMesh||B.isLine||B.isPoints)){if((B.castShadow||B.receiveShadow&&O===U5)&&(!B.frustumCulled||Q.intersectsObject(B))){B.modelViewMatrix.multiplyMatrices(b.matrixWorldInverse,B.matrixWorld);let p=J.update(B),u=B.material;if(Array.isArray(u)){let t=p.groups;for(let m=0,e=t.length;m<e;m++){let d=t[m],Q0=u[d.materialIndex];if(Q0&&Q0.visible){let w0=D(B,Q0,z,O);B.onBeforeShadow($,B,S,b,p,w0,d),$.renderBufferDirect(b,null,p,w0,B,d),B.onAfterShadow($,B,S,b,p,w0,d)}}}else if(u.visible){let t=D(B,u,z,O);B.onBeforeShadow($,B,S,b,p,t,null),$.renderBufferDirect(b,null,p,t,B,null),B.onAfterShadow($,B,S,b,p,t,null)}}}let g=B.children;for(let p=0,u=g.length;p<u;p++)P(g[p],S,b,z,O)}function h(B){B.target.removeEventListener("dispose",h);for(let b in E){let z=E[b],O=B.target.uuid;if(O in z)z[O].dispose(),delete z[O]}}}var FE={[H$]:k$,[A8]:W$,[K$]:E$,[w6]:w$,[k$]:H$,[W$]:A8,[E$]:K$,[w$]:w6};function LE($,J){function M(){let C=!1,o=new U1,J0=null,W0=new U1(0,0,0,0);return{setMask:function(M0){if(J0!==M0&&!C)$.colorMask(M0,M0,M0,M0),J0=M0},setLocked:function(M0){C=M0},setClear:function(M0,r,V0,b0,s0){if(s0===!0)M0*=b0,r*=b0,V0*=b0;if(o.set(M0,r,V0,b0),W0.equals(o)===!1)$.clearColor(M0,r,V0,b0),W0.copy(o)},reset:function(){C=!1,J0=null,W0.set(-1,0,0,0)}}}function Q(){let C=!1,o=!1,J0=null,W0=null,M0=null;return{setReversed:function(r){if(o!==r){let V0=J.get("EXT_clip_control");if(r)V0.clipControlEXT(V0.LOWER_LEFT_EXT,V0.ZERO_TO_ONE_EXT);else V0.clipControlEXT(V0.LOWER_LEFT_EXT,V0.NEGATIVE_ONE_TO_ONE_EXT);o=r;let b0=M0;M0=null,this.setClear(b0)}},getReversed:function(){return o},setTest:function(r){if(r)H0($.DEPTH_TEST);else E0($.DEPTH_TEST)},setMask:function(r){if(J0!==r&&!C)$.depthMask(r),J0=r},setFunc:function(r){if(o)r=FE[r];if(W0!==r){switch(r){case H$:$.depthFunc($.NEVER);break;case k$:$.depthFunc($.ALWAYS);break;case A8:$.depthFunc($.LESS);break;case w6:$.depthFunc($.LEQUAL);break;case K$:$.depthFunc($.EQUAL);break;case w$:$.depthFunc($.GEQUAL);break;case W$:$.depthFunc($.GREATER);break;case E$:$.depthFunc($.NOTEQUAL);break;default:$.depthFunc($.LEQUAL)}W0=r}},setLocked:function(r){C=r},setClear:function(r){if(M0!==r){if(o)r=1-r;$.clearDepth(r),M0=r}},reset:function(){C=!1,J0=null,W0=null,M0=null,o=!1}}}function H(){let C=!1,o=null,J0=null,W0=null,M0=null,r=null,V0=null,b0=null,s0=null;return{setTest:function(i0){if(!C)if(i0)H0($.STENCIL_TEST);else E0($.STENCIL_TEST)},setMask:function(i0){if(o!==i0&&!C)$.stencilMask(i0),o=i0},setFunc:function(i0,O1,V1){if(J0!==i0||W0!==O1||M0!==V1)$.stencilFunc(i0,O1,V1),J0=i0,W0=O1,M0=V1},setOp:function(i0,O1,V1){if(r!==i0||V0!==O1||b0!==V1)$.stencilOp(i0,O1,V1),r=i0,V0=O1,b0=V1},setLocked:function(i0){C=i0},setClear:function(i0){if(s0!==i0)$.clearStencil(i0),s0=i0},reset:function(){C=!1,o=null,J0=null,W0=null,M0=null,r=null,V0=null,b0=null,s0=null}}}let k=new M,K=new Q,w=new H,W=new WeakMap,E=new WeakMap,R={},Z={},U=new WeakMap,X=[],G=null,q=!1,Y=null,N=null,V=null,D=null,P=null,h=null,B=null,S=new e0(0,0,0),b=0,z=!1,O=null,f=null,g=null,p=null,u=null,t=$.getParameter($.MAX_COMBINED_TEXTURE_IMAGE_UNITS),m=!1,e=0,d=$.getParameter($.VERSION);if(d.indexOf("WebGL")!==-1)e=parseFloat(/^WebGL (\d)/.exec(d)[1]),m=e>=1;else if(d.indexOf("OpenGL ES")!==-1)e=parseFloat(/^OpenGL ES (\d)/.exec(d)[1]),m=e>=2;let Q0=null,w0={},D0=$.getParameter($.SCISSOR_BOX),v0=$.getParameter($.VIEWPORT),l0=new U1().fromArray(D0),c=new U1().fromArray(v0);function R0(C,o,J0,W0){let M0=new Uint8Array(4),r=$.createTexture();$.bindTexture(C,r),$.texParameteri(C,$.TEXTURE_MIN_FILTER,$.NEAREST),$.texParameteri(C,$.TEXTURE_MAG_FILTER,$.NEAREST);for(let V0=0;V0<J0;V0++)if(C===$.TEXTURE_3D||C===$.TEXTURE_2D_ARRAY)$.texImage3D(o,0,$.RGBA,1,1,W0,0,$.RGBA,$.UNSIGNED_BYTE,M0);else $.texImage2D(o+V0,0,$.RGBA,1,1,0,$.RGBA,$.UNSIGNED_BYTE,M0);return r}let G0={};G0[$.TEXTURE_2D]=R0($.TEXTURE_2D,$.TEXTURE_2D,1),G0[$.TEXTURE_CUBE_MAP]=R0($.TEXTURE_CUBE_MAP,$.TEXTURE_CUBE_MAP_POSITIVE_X,6),G0[$.TEXTURE_2D_ARRAY]=R0($.TEXTURE_2D_ARRAY,$.TEXTURE_2D_ARRAY,1,1),G0[$.TEXTURE_3D]=R0($.TEXTURE_3D,$.TEXTURE_3D,1,1),k.setClear(0,0,0,1),K.setClear(1),w.setClear(0),H0($.DEPTH_TEST),K.setFunc(w6),q0(!1),n0(V9),H0($.CULL_FACE),F0(v5);function H0(C){if(R[C]!==!0)$.enable(C),R[C]=!0}function E0(C){if(R[C]!==!1)$.disable(C),R[C]=!1}function T0(C,o){if(Z[C]!==o){if($.bindFramebuffer(C,o),Z[C]=o,C===$.DRAW_FRAMEBUFFER)Z[$.FRAMEBUFFER]=o;if(C===$.FRAMEBUFFER)Z[$.DRAW_FRAMEBUFFER]=o;return!0}return!1}function h0(C,o){let J0=X,W0=!1;if(C){if(J0=U.get(o),J0===void 0)J0=[],U.set(o,J0);let M0=C.textures;if(J0.length!==M0.length||J0[0]!==$.COLOR_ATTACHMENT0){for(let r=0,V0=M0.length;r<V0;r++)J0[r]=$.COLOR_ATTACHMENT0+r;J0.length=M0.length,W0=!0}}else if(J0[0]!==$.BACK)J0[0]=$.BACK,W0=!0;if(W0)$.drawBuffers(J0)}function _0(C){if(G!==C)return $.useProgram(C),G=C,!0;return!1}let T={[_8]:$.FUNC_ADD,[nJ]:$.FUNC_SUBTRACT,[sJ]:$.FUNC_REVERSE_SUBTRACT};T[oJ]=$.MIN,T[iJ]=$.MAX;let d0={[rJ]:$.ZERO,[aJ]:$.ONE,[tJ]:$.SRC_COLOR,[$M]:$.SRC_ALPHA,[KM]:$.SRC_ALPHA_SATURATE,[HM]:$.DST_COLOR,[MM]:$.DST_ALPHA,[eJ]:$.ONE_MINUS_SRC_COLOR,[JM]:$.ONE_MINUS_SRC_ALPHA,[kM]:$.ONE_MINUS_DST_COLOR,[QM]:$.ONE_MINUS_DST_ALPHA,[wM]:$.CONSTANT_COLOR,[WM]:$.ONE_MINUS_CONSTANT_COLOR,[EM]:$.CONSTANT_ALPHA,[ZM]:$.ONE_MINUS_CONSTANT_ALPHA};function F0(C,o,J0,W0,M0,r,V0,b0,s0,i0){if(C===v5){if(q===!0)E0($.BLEND),q=!1;return}if(q===!1)H0($.BLEND),q=!0;if(C!==cJ){if(C!==Y||i0!==z){if(N!==_8||P!==_8)$.blendEquation($.FUNC_ADD),N=_8,P=_8;if(i0)switch(C){case K6:$.blendFuncSeparate($.ONE,$.ONE_MINUS_SRC_ALPHA,$.ONE,$.ONE_MINUS_SRC_ALPHA);break;case I9:$.blendFunc($.ONE,$.ONE);break;case C9:$.blendFuncSeparate($.ZERO,$.ONE_MINUS_SRC_COLOR,$.ZERO,$.ONE);break;case _9:$.blendFuncSeparate($.DST_COLOR,$.ONE_MINUS_SRC_ALPHA,$.ZERO,$.ONE);break;default:console.error("THREE.WebGLState: Invalid blending: ",C);break}else switch(C){case K6:$.blendFuncSeparate($.SRC_ALPHA,$.ONE_MINUS_SRC_ALPHA,$.ONE,$.ONE_MINUS_SRC_ALPHA);break;case I9:$.blendFuncSeparate($.SRC_ALPHA,$.ONE,$.ONE,$.ONE);break;case C9:console.error("THREE.WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case _9:console.error("THREE.WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:console.error("THREE.WebGLState: Invalid blending: ",C);break}V=null,D=null,h=null,B=null,S.set(0,0,0),b=0,Y=C,z=i0}return}if(M0=M0||o,r=r||J0,V0=V0||W0,o!==N||M0!==P)$.blendEquationSeparate(T[o],T[M0]),N=o,P=M0;if(J0!==V||W0!==D||r!==h||V0!==B)$.blendFuncSeparate(d0[J0],d0[W0],d0[r],d0[V0]),V=J0,D=W0,h=r,B=V0;if(b0.equals(S)===!1||s0!==b)$.blendColor(b0.r,b0.g,b0.b,s0),S.copy(b0),b=s0;Y=C,z=!1}function x0(C,o){C.side===n1?E0($.CULL_FACE):H0($.CULL_FACE);let J0=C.side===c1;if(o)J0=!J0;q0(J0),C.blending===K6&&C.transparent===!1?F0(v5):F0(C.blending,C.blendEquation,C.blendSrc,C.blendDst,C.blendEquationAlpha,C.blendSrcAlpha,C.blendDstAlpha,C.blendColor,C.blendAlpha,C.premultipliedAlpha),K.setFunc(C.depthFunc),K.setTest(C.depthTest),K.setMask(C.depthWrite),k.setMask(C.colorWrite);let W0=C.stencilWrite;if(w.setTest(W0),W0)w.setMask(C.stencilWriteMask),w.setFunc(C.stencilFunc,C.stencilRef,C.stencilFuncMask),w.setOp(C.stencilFail,C.stencilZFail,C.stencilZPass);z0(C.polygonOffset,C.polygonOffsetFactor,C.polygonOffsetUnits),C.alphaToCoverage===!0?H0($.SAMPLE_ALPHA_TO_COVERAGE):E0($.SAMPLE_ALPHA_TO_COVERAGE)}function q0(C){if(O!==C){if(C)$.frontFace($.CW);else $.frontFace($.CCW);O=C}}function n0(C){if(C!==dJ){if(H0($.CULL_FACE),C!==f)if(C===V9)$.cullFace($.BACK);else if(C===mJ)$.cullFace($.FRONT);else $.cullFace($.FRONT_AND_BACK)}else E0($.CULL_FACE);f=C}function N0(C){if(C!==g){if(m)$.lineWidth(C);g=C}}function z0(C,o,J0){if(C){if(H0($.POLYGON_OFFSET_FILL),p!==o||u!==J0)$.polygonOffset(o,J0),p=o,u=J0}else E0($.POLYGON_OFFSET_FILL)}function a0(C){if(C)H0($.SCISSOR_TEST);else E0($.SCISSOR_TEST)}function o0(C){if(C===void 0)C=$.TEXTURE0+t-1;if(Q0!==C)$.activeTexture(C),Q0=C}function M1(C,o,J0){if(J0===void 0)if(Q0===null)J0=$.TEXTURE0+t-1;else J0=Q0;let W0=w0[J0];if(W0===void 0)W0={type:void 0,texture:void 0},w0[J0]=W0;if(W0.type!==C||W0.texture!==o){if(Q0!==J0)$.activeTexture(J0),Q0=J0;$.bindTexture(C,o||G0[C]),W0.type=C,W0.texture=o}}function I(){let C=w0[Q0];if(C!==void 0&&C.type!==void 0)$.bindTexture(C.type,null),C.type=void 0,C.texture=void 0}function F(){try{$.compressedTexImage2D(...arguments)}catch(C){console.error("THREE.WebGLState:",C)}}function v(){try{$.compressedTexImage3D(...arguments)}catch(C){console.error("THREE.WebGLState:",C)}}function i(){try{$.texSubImage2D(...arguments)}catch(C){console.error("THREE.WebGLState:",C)}}function $0(){try{$.texSubImage3D(...arguments)}catch(C){console.error("THREE.WebGLState:",C)}}function s(){try{$.compressedTexSubImage2D(...arguments)}catch(C){console.error("THREE.WebGLState:",C)}}function O0(){try{$.compressedTexSubImage3D(...arguments)}catch(C){console.error("THREE.WebGLState:",C)}}function Z0(){try{$.texStorage2D(...arguments)}catch(C){console.error("THREE.WebGLState:",C)}}function P0(){try{$.texStorage3D(...arguments)}catch(C){console.error("THREE.WebGLState:",C)}}function S0(){try{$.texImage2D(...arguments)}catch(C){console.error("THREE.WebGLState:",C)}}function k0(){try{$.texImage3D(...arguments)}catch(C){console.error("THREE.WebGLState:",C)}}function U0(C){if(l0.equals(C)===!1)$.scissor(C.x,C.y,C.z,C.w),l0.copy(C)}function C0(C){if(c.equals(C)===!1)$.viewport(C.x,C.y,C.z,C.w),c.copy(C)}function I0(C,o){let J0=E.get(o);if(J0===void 0)J0=new WeakMap,E.set(o,J0);let W0=J0.get(C);if(W0===void 0)W0=$.getUniformBlockIndex(o,C.name),J0.set(C,W0)}function _(C,o){let W0=E.get(o).get(C);if(W.get(o)!==W0)$.uniformBlockBinding(o,W0,C.__bindingPointIndex),W.set(o,W0)}function n(){$.disable($.BLEND),$.disable($.CULL_FACE),$.disable($.DEPTH_TEST),$.disable($.POLYGON_OFFSET_FILL),$.disable($.SCISSOR_TEST),$.disable($.STENCIL_TEST),$.disable($.SAMPLE_ALPHA_TO_COVERAGE),$.blendEquation($.FUNC_ADD),$.blendFunc($.ONE,$.ZERO),$.blendFuncSeparate($.ONE,$.ZERO,$.ONE,$.ZERO),$.blendColor(0,0,0,0),$.colorMask(!0,!0,!0,!0),$.clearColor(0,0,0,0),$.depthMask(!0),$.depthFunc($.LESS),K.setReversed(!1),$.clearDepth(1),$.stencilMask(4294967295),$.stencilFunc($.ALWAYS,0,4294967295),$.stencilOp($.KEEP,$.KEEP,$.KEEP),$.clearStencil(0),$.cullFace($.BACK),$.frontFace($.CCW),$.polygonOffset(0,0),$.activeTexture($.TEXTURE0),$.bindFramebuffer($.FRAMEBUFFER,null),$.bindFramebuffer($.DRAW_FRAMEBUFFER,null),$.bindFramebuffer($.READ_FRAMEBUFFER,null),$.useProgram(null),$.lineWidth(1),$.scissor(0,0,$.canvas.width,$.canvas.height),$.viewport(0,0,$.canvas.width,$.canvas.height),R={},Q0=null,w0={},Z={},U=new WeakMap,X=[],G=null,q=!1,Y=null,N=null,V=null,D=null,P=null,h=null,B=null,S=new e0(0,0,0),b=0,z=!1,O=null,f=null,g=null,p=null,u=null,l0.set(0,0,$.canvas.width,$.canvas.height),c.set(0,0,$.canvas.width,$.canvas.height),k.reset(),K.reset(),w.reset()}return{buffers:{color:k,depth:K,stencil:w},enable:H0,disable:E0,bindFramebuffer:T0,drawBuffers:h0,useProgram:_0,setBlending:F0,setMaterial:x0,setFlipSided:q0,setCullFace:n0,setLineWidth:N0,setPolygonOffset:z0,setScissorTest:a0,activeTexture:o0,bindTexture:M1,unbindTexture:I,compressedTexImage2D:F,compressedTexImage3D:v,texImage2D:S0,texImage3D:k0,updateUBOMapping:I0,uniformBlockBinding:_,texStorage2D:Z0,texStorage3D:P0,texSubImage2D:i,texSubImage3D:$0,compressedTexSubImage2D:s,compressedTexSubImage3D:O0,scissor:U0,viewport:C0,reset:n}}function PE($,J,M,Q,H,k,K){let w=J.has("WEBGL_multisampled_render_to_texture")?J.get("WEBGL_multisampled_render_to_texture"):null,W=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),E=new J1,R=new WeakMap,Z,U=new WeakMap,X=!1;try{X=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch(I){}function G(I,F){return X?new OffscreenCanvas(I,F):k6("canvas")}function q(I,F,v){let i=1,$0=M1(I);if($0.width>v||$0.height>v)i=v/Math.max($0.width,$0.height);if(i<1)if(typeof HTMLImageElement<"u"&&I instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&I instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&I instanceof ImageBitmap||typeof VideoFrame<"u"&&I instanceof VideoFrame){let s=Math.floor(i*$0.width),O0=Math.floor(i*$0.height);if(Z===void 0)Z=G(s,O0);let Z0=F?G(s,O0):Z;return Z0.width=s,Z0.height=O0,Z0.getContext("2d").drawImage(I,0,0,s,O0),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+$0.width+"x"+$0.height+") to ("+s+"x"+O0+")."),Z0}else{if("data"in I)console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+$0.width+"x"+$0.height+").");return I}return I}function Y(I){return I.generateMipmaps}function N(I){$.generateMipmap(I)}function V(I){if(I.isWebGLCubeRenderTarget)return $.TEXTURE_CUBE_MAP;if(I.isWebGL3DRenderTarget)return $.TEXTURE_3D;if(I.isWebGLArrayRenderTarget||I.isCompressedArrayTexture)return $.TEXTURE_2D_ARRAY;return $.TEXTURE_2D}function D(I,F,v,i,$0=!1){if(I!==null){if($[I]!==void 0)return $[I];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+I+"'")}let s=F;if(F===$.RED){if(v===$.FLOAT)s=$.R32F;if(v===$.HALF_FLOAT)s=$.R16F;if(v===$.UNSIGNED_BYTE)s=$.R8}if(F===$.RED_INTEGER){if(v===$.UNSIGNED_BYTE)s=$.R8UI;if(v===$.UNSIGNED_SHORT)s=$.R16UI;if(v===$.UNSIGNED_INT)s=$.R32UI;if(v===$.BYTE)s=$.R8I;if(v===$.SHORT)s=$.R16I;if(v===$.INT)s=$.R32I}if(F===$.RG){if(v===$.FLOAT)s=$.RG32F;if(v===$.HALF_FLOAT)s=$.RG16F;if(v===$.UNSIGNED_BYTE)s=$.RG8}if(F===$.RG_INTEGER){if(v===$.UNSIGNED_BYTE)s=$.RG8UI;if(v===$.UNSIGNED_SHORT)s=$.RG16UI;if(v===$.UNSIGNED_INT)s=$.RG32UI;if(v===$.BYTE)s=$.RG8I;if(v===$.SHORT)s=$.RG16I;if(v===$.INT)s=$.RG32I}if(F===$.RGB_INTEGER){if(v===$.UNSIGNED_BYTE)s=$.RGB8UI;if(v===$.UNSIGNED_SHORT)s=$.RGB16UI;if(v===$.UNSIGNED_INT)s=$.RGB32UI;if(v===$.BYTE)s=$.RGB8I;if(v===$.SHORT)s=$.RGB16I;if(v===$.INT)s=$.RGB32I}if(F===$.RGBA_INTEGER){if(v===$.UNSIGNED_BYTE)s=$.RGBA8UI;if(v===$.UNSIGNED_SHORT)s=$.RGBA16UI;if(v===$.UNSIGNED_INT)s=$.RGBA32UI;if(v===$.BYTE)s=$.RGBA8I;if(v===$.SHORT)s=$.RGBA16I;if(v===$.INT)s=$.RGBA32I}if(F===$.RGB){if(v===$.UNSIGNED_INT_5_9_9_9_REV)s=$.RGB9_E5}if(F===$.RGBA){let O0=$0?w7:r0.getTransfer(i);if(v===$.FLOAT)s=$.RGBA32F;if(v===$.HALF_FLOAT)s=$.RGBA16F;if(v===$.UNSIGNED_BYTE)s=O0===K1?$.SRGB8_ALPHA8:$.RGBA8;if(v===$.UNSIGNED_SHORT_4_4_4_4)s=$.RGBA4;if(v===$.UNSIGNED_SHORT_5_5_5_1)s=$.RGB5_A1}if(s===$.R16F||s===$.R32F||s===$.RG16F||s===$.RG32F||s===$.RGBA16F||s===$.RGBA32F)J.get("EXT_color_buffer_float");return s}function P(I,F){let v;if(I){if(F===null||F===h8||F===f8)v=$.DEPTH24_STENCIL8;else if(F===b5)v=$.DEPTH32F_STENCIL8;else if(F===Z6)v=$.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")}else if(F===null||F===h8||F===f8)v=$.DEPTH_COMPONENT24;else if(F===b5)v=$.DEPTH_COMPONENT32F;else if(F===Z6)v=$.DEPTH_COMPONENT16;return v}function h(I,F){if(Y(I)===!0||I.isFramebufferTexture&&I.minFilter!==s1&&I.minFilter!==t5)return Math.log2(Math.max(F.width,F.height))+1;else if(I.mipmaps!==void 0&&I.mipmaps.length>0)return I.mipmaps.length;else if(I.isCompressedTexture&&Array.isArray(I.image))return F.mipmaps.length;else return 1}function B(I){let F=I.target;if(F.removeEventListener("dispose",B),b(F),F.isVideoTexture)R.delete(F)}function S(I){let F=I.target;F.removeEventListener("dispose",S),O(F)}function b(I){let F=Q.get(I);if(F.__webglInit===void 0)return;let v=I.source,i=U.get(v);if(i){let $0=i[F.__cacheKey];if($0.usedTimes--,$0.usedTimes===0)z(I);if(Object.keys(i).length===0)U.delete(v)}Q.remove(I)}function z(I){let F=Q.get(I);$.deleteTexture(F.__webglTexture);let v=I.source,i=U.get(v);delete i[F.__cacheKey],K.memory.textures--}function O(I){let F=Q.get(I);if(I.depthTexture)I.depthTexture.dispose(),Q.remove(I.depthTexture);if(I.isWebGLCubeRenderTarget)for(let i=0;i<6;i++){if(Array.isArray(F.__webglFramebuffer[i]))for(let $0=0;$0<F.__webglFramebuffer[i].length;$0++)$.deleteFramebuffer(F.__webglFramebuffer[i][$0]);else $.deleteFramebuffer(F.__webglFramebuffer[i]);if(F.__webglDepthbuffer)$.deleteRenderbuffer(F.__webglDepthbuffer[i])}else{if(Array.isArray(F.__webglFramebuffer))for(let i=0;i<F.__webglFramebuffer.length;i++)$.deleteFramebuffer(F.__webglFramebuffer[i]);else $.deleteFramebuffer(F.__webglFramebuffer);if(F.__webglDepthbuffer)$.deleteRenderbuffer(F.__webglDepthbuffer);if(F.__webglMultisampledFramebuffer)$.deleteFramebuffer(F.__webglMultisampledFramebuffer);if(F.__webglColorRenderbuffer){for(let i=0;i<F.__webglColorRenderbuffer.length;i++)if(F.__webglColorRenderbuffer[i])$.deleteRenderbuffer(F.__webglColorRenderbuffer[i])}if(F.__webglDepthRenderbuffer)$.deleteRenderbuffer(F.__webglDepthRenderbuffer)}let v=I.textures;for(let i=0,$0=v.length;i<$0;i++){let s=Q.get(v[i]);if(s.__webglTexture)$.deleteTexture(s.__webglTexture),K.memory.textures--;Q.remove(v[i])}Q.remove(I)}let f=0;function g(){f=0}function p(){let I=f;if(I>=H.maxTextures)console.warn("THREE.WebGLTextures: Trying to use "+I+" texture units while this GPU supports only "+H.maxTextures);return f+=1,I}function u(I){let F=[];return F.push(I.wrapS),F.push(I.wrapT),F.push(I.wrapR||0),F.push(I.magFilter),F.push(I.minFilter),F.push(I.anisotropy),F.push(I.internalFormat),F.push(I.format),F.push(I.type),F.push(I.generateMipmaps),F.push(I.premultiplyAlpha),F.push(I.flipY),F.push(I.unpackAlignment),F.push(I.colorSpace),F.join()}function t(I,F){let v=Q.get(I);if(I.isVideoTexture)a0(I);if(I.isRenderTargetTexture===!1&&I.isExternalTexture!==!0&&I.version>0&&v.__version!==I.version){let i=I.image;if(i===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(i.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{G0(v,I,F);return}}else if(I.isExternalTexture)v.__webglTexture=I.sourceTexture?I.sourceTexture:null;M.bindTexture($.TEXTURE_2D,v.__webglTexture,$.TEXTURE0+F)}function m(I,F){let v=Q.get(I);if(I.isRenderTargetTexture===!1&&I.version>0&&v.__version!==I.version){G0(v,I,F);return}M.bindTexture($.TEXTURE_2D_ARRAY,v.__webglTexture,$.TEXTURE0+F)}function e(I,F){let v=Q.get(I);if(I.isRenderTargetTexture===!1&&I.version>0&&v.__version!==I.version){G0(v,I,F);return}M.bindTexture($.TEXTURE_3D,v.__webglTexture,$.TEXTURE0+F)}function d(I,F){let v=Q.get(I);if(I.version>0&&v.__version!==I.version){H0(v,I,F);return}M.bindTexture($.TEXTURE_CUBE_MAP,v.__webglTexture,$.TEXTURE0+F)}let Q0={[LM]:$.REPEAT,[PM]:$.CLAMP_TO_EDGE,[zM]:$.MIRRORED_REPEAT},w0={[s1]:$.NEAREST,[VM]:$.NEAREST_MIPMAP_NEAREST,[E6]:$.NEAREST_MIPMAP_LINEAR,[t5]:$.LINEAR,[U$]:$.LINEAR_MIPMAP_NEAREST,[T8]:$.LINEAR_MIPMAP_LINEAR},D0={[bM]:$.NEVER,[mM]:$.ALWAYS,[pM]:$.LESS,[W7]:$.LEQUAL,[xM]:$.EQUAL,[dM]:$.GEQUAL,[gM]:$.GREATER,[lM]:$.NOTEQUAL};function v0(I,F){if(F.type===b5&&J.has("OES_texture_float_linear")===!1&&(F.magFilter===t5||F.magFilter===U$||F.magFilter===E6||F.magFilter===T8||F.minFilter===t5||F.minFilter===U$||F.minFilter===E6||F.minFilter===T8))console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device.");if($.texParameteri(I,$.TEXTURE_WRAP_S,Q0[F.wrapS]),$.texParameteri(I,$.TEXTURE_WRAP_T,Q0[F.wrapT]),I===$.TEXTURE_3D||I===$.TEXTURE_2D_ARRAY)$.texParameteri(I,$.TEXTURE_WRAP_R,Q0[F.wrapR]);if($.texParameteri(I,$.TEXTURE_MAG_FILTER,w0[F.magFilter]),$.texParameteri(I,$.TEXTURE_MIN_FILTER,w0[F.minFilter]),F.compareFunction)$.texParameteri(I,$.TEXTURE_COMPARE_MODE,$.COMPARE_REF_TO_TEXTURE),$.texParameteri(I,$.TEXTURE_COMPARE_FUNC,D0[F.compareFunction]);if(J.has("EXT_texture_filter_anisotropic")===!0){if(F.magFilter===s1)return;if(F.minFilter!==E6&&F.minFilter!==T8)return;if(F.type===b5&&J.has("OES_texture_float_linear")===!1)return;if(F.anisotropy>1||Q.get(F).__currentAnisotropy){let v=J.get("EXT_texture_filter_anisotropic");$.texParameterf(I,v.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(F.anisotropy,H.getMaxAnisotropy())),Q.get(F).__currentAnisotropy=F.anisotropy}}}function l0(I,F){let v=!1;if(I.__webglInit===void 0)I.__webglInit=!0,F.addEventListener("dispose",B);let i=F.source,$0=U.get(i);if($0===void 0)$0={},U.set(i,$0);let s=u(F);if(s!==I.__cacheKey){if($0[s]===void 0)$0[s]={texture:$.createTexture(),usedTimes:0},K.memory.textures++,v=!0;$0[s].usedTimes++;let O0=$0[I.__cacheKey];if(O0!==void 0){if($0[I.__cacheKey].usedTimes--,O0.usedTimes===0)z(F)}I.__cacheKey=s,I.__webglTexture=$0[s].texture}return v}function c(I,F,v){return Math.floor(Math.floor(I/v)/F)}function R0(I,F,v,i){let s=I.updateRanges;if(s.length===0)M.texSubImage2D($.TEXTURE_2D,0,0,0,F.width,F.height,v,i,F.data);else{s.sort((k0,U0)=>k0.start-U0.start);let O0=0;for(let k0=1;k0<s.length;k0++){let U0=s[O0],C0=s[k0],I0=U0.start+U0.count,_=c(C0.start,F.width,4),n=c(U0.start,F.width,4);if(C0.start<=I0+1&&_===n&&c(C0.start+C0.count-1,F.width,4)===_)U0.count=Math.max(U0.count,C0.start+C0.count-U0.start);else++O0,s[O0]=C0}s.length=O0+1;let Z0=$.getParameter($.UNPACK_ROW_LENGTH),P0=$.getParameter($.UNPACK_SKIP_PIXELS),S0=$.getParameter($.UNPACK_SKIP_ROWS);$.pixelStorei($.UNPACK_ROW_LENGTH,F.width);for(let k0=0,U0=s.length;k0<U0;k0++){let C0=s[k0],I0=Math.floor(C0.start/4),_=Math.ceil(C0.count/4),n=I0%F.width,C=Math.floor(I0/F.width),o=_,J0=1;$.pixelStorei($.UNPACK_SKIP_PIXELS,n),$.pixelStorei($.UNPACK_SKIP_ROWS,C),M.texSubImage2D($.TEXTURE_2D,0,n,C,o,1,v,i,F.data)}I.clearUpdateRanges(),$.pixelStorei($.UNPACK_ROW_LENGTH,Z0),$.pixelStorei($.UNPACK_SKIP_PIXELS,P0),$.pixelStorei($.UNPACK_SKIP_ROWS,S0)}}function G0(I,F,v){let i=$.TEXTURE_2D;if(F.isDataArrayTexture||F.isCompressedArrayTexture)i=$.TEXTURE_2D_ARRAY;if(F.isData3DTexture)i=$.TEXTURE_3D;let $0=l0(I,F),s=F.source;M.bindTexture(i,I.__webglTexture,$.TEXTURE0+v);let O0=Q.get(s);if(s.version!==O0.__version||$0===!0){M.activeTexture($.TEXTURE0+v);let Z0=r0.getPrimaries(r0.workingColorSpace),P0=F.colorSpace===e5?null:r0.getPrimaries(F.colorSpace),S0=F.colorSpace===e5||Z0===P0?$.NONE:$.BROWSER_DEFAULT_WEBGL;$.pixelStorei($.UNPACK_FLIP_Y_WEBGL,F.flipY),$.pixelStorei($.UNPACK_PREMULTIPLY_ALPHA_WEBGL,F.premultiplyAlpha),$.pixelStorei($.UNPACK_ALIGNMENT,F.unpackAlignment),$.pixelStorei($.UNPACK_COLORSPACE_CONVERSION_WEBGL,S0);let k0=q(F.image,!1,H.maxTextureSize);k0=o0(F,k0);let U0=k.convert(F.format,F.colorSpace),C0=k.convert(F.type),I0=D(F.internalFormat,U0,C0,F.colorSpace,F.isVideoTexture);v0(i,F);let _,n=F.mipmaps,C=F.isVideoTexture!==!0,o=O0.__version===void 0||$0===!0,J0=s.dataReady,W0=h(F,k0);if(F.isDepthTexture){if(I0=P(F.format===U6,F.type),o)if(C)M.texStorage2D($.TEXTURE_2D,1,I0,k0.width,k0.height);else M.texImage2D($.TEXTURE_2D,0,I0,k0.width,k0.height,0,U0,C0,null)}else if(F.isDataTexture)if(n.length>0){if(C&&o)M.texStorage2D($.TEXTURE_2D,W0,I0,n[0].width,n[0].height);for(let M0=0,r=n.length;M0<r;M0++)if(_=n[M0],C){if(J0)M.texSubImage2D($.TEXTURE_2D,M0,0,0,_.width,_.height,U0,C0,_.data)}else M.texImage2D($.TEXTURE_2D,M0,I0,_.width,_.height,0,U0,C0,_.data);F.generateMipmaps=!1}else if(C){if(o)M.texStorage2D($.TEXTURE_2D,W0,I0,k0.width,k0.height);if(J0)R0(F,k0,U0,C0)}else M.texImage2D($.TEXTURE_2D,0,I0,k0.width,k0.height,0,U0,C0,k0.data);else if(F.isCompressedTexture)if(F.isCompressedArrayTexture){if(C&&o)M.texStorage3D($.TEXTURE_2D_ARRAY,W0,I0,n[0].width,n[0].height,k0.depth);for(let M0=0,r=n.length;M0<r;M0++)if(_=n[M0],F.format!==J5)if(U0!==null)if(C){if(J0)if(F.layerUpdates.size>0){let V0=f7(_.width,_.height,F.format,F.type);for(let b0 of F.layerUpdates){let s0=_.data.subarray(b0*V0/_.data.BYTES_PER_ELEMENT,(b0+1)*V0/_.data.BYTES_PER_ELEMENT);M.compressedTexSubImage3D($.TEXTURE_2D_ARRAY,M0,0,0,b0,_.width,_.height,1,U0,s0)}F.clearLayerUpdates()}else M.compressedTexSubImage3D($.TEXTURE_2D_ARRAY,M0,0,0,0,_.width,_.height,k0.depth,U0,_.data)}else M.compressedTexImage3D($.TEXTURE_2D_ARRAY,M0,I0,_.width,_.height,k0.depth,0,_.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else if(C){if(J0)M.texSubImage3D($.TEXTURE_2D_ARRAY,M0,0,0,0,_.width,_.height,k0.depth,U0,C0,_.data)}else M.texImage3D($.TEXTURE_2D_ARRAY,M0,I0,_.width,_.height,k0.depth,0,U0,C0,_.data)}else{if(C&&o)M.texStorage2D($.TEXTURE_2D,W0,I0,n[0].width,n[0].height);for(let M0=0,r=n.length;M0<r;M0++)if(_=n[M0],F.format!==J5)if(U0!==null)if(C){if(J0)M.compressedTexSubImage2D($.TEXTURE_2D,M0,0,0,_.width,_.height,U0,_.data)}else M.compressedTexImage2D($.TEXTURE_2D,M0,I0,_.width,_.height,0,_.data);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else if(C){if(J0)M.texSubImage2D($.TEXTURE_2D,M0,0,0,_.width,_.height,U0,C0,_.data)}else M.texImage2D($.TEXTURE_2D,M0,I0,_.width,_.height,0,U0,C0,_.data)}else if(F.isDataArrayTexture)if(C){if(o)M.texStorage3D($.TEXTURE_2D_ARRAY,W0,I0,k0.width,k0.height,k0.depth);if(J0)if(F.layerUpdates.size>0){let M0=f7(k0.width,k0.height,F.format,F.type);for(let r of F.layerUpdates){let V0=k0.data.subarray(r*M0/k0.data.BYTES_PER_ELEMENT,(r+1)*M0/k0.data.BYTES_PER_ELEMENT);M.texSubImage3D($.TEXTURE_2D_ARRAY,0,0,0,r,k0.width,k0.height,1,U0,C0,V0)}F.clearLayerUpdates()}else M.texSubImage3D($.TEXTURE_2D_ARRAY,0,0,0,0,k0.width,k0.height,k0.depth,U0,C0,k0.data)}else M.texImage3D($.TEXTURE_2D_ARRAY,0,I0,k0.width,k0.height,k0.depth,0,U0,C0,k0.data);else if(F.isData3DTexture)if(C){if(o)M.texStorage3D($.TEXTURE_3D,W0,I0,k0.width,k0.height,k0.depth);if(J0)M.texSubImage3D($.TEXTURE_3D,0,0,0,0,k0.width,k0.height,k0.depth,U0,C0,k0.data)}else M.texImage3D($.TEXTURE_3D,0,I0,k0.width,k0.height,k0.depth,0,U0,C0,k0.data);else if(F.isFramebufferTexture){if(o)if(C)M.texStorage2D($.TEXTURE_2D,W0,I0,k0.width,k0.height);else{let{width:M0,height:r}=k0;for(let V0=0;V0<W0;V0++)M.texImage2D($.TEXTURE_2D,V0,I0,M0,r,0,U0,C0,null),M0>>=1,r>>=1}}else if(n.length>0){if(C&&o){let M0=M1(n[0]);M.texStorage2D($.TEXTURE_2D,W0,I0,M0.width,M0.height)}for(let M0=0,r=n.length;M0<r;M0++)if(_=n[M0],C){if(J0)M.texSubImage2D($.TEXTURE_2D,M0,0,0,U0,C0,_)}else M.texImage2D($.TEXTURE_2D,M0,I0,U0,C0,_);F.generateMipmaps=!1}else if(C){if(o){let M0=M1(k0);M.texStorage2D($.TEXTURE_2D,W0,I0,M0.width,M0.height)}if(J0)M.texSubImage2D($.TEXTURE_2D,0,0,0,U0,C0,k0)}else M.texImage2D($.TEXTURE_2D,0,I0,U0,C0,k0);if(Y(F))N(i);if(O0.__version=s.version,F.onUpdate)F.onUpdate(F)}I.__version=F.version}function H0(I,F,v){if(F.image.length!==6)return;let i=l0(I,F),$0=F.source;M.bindTexture($.TEXTURE_CUBE_MAP,I.__webglTexture,$.TEXTURE0+v);let s=Q.get($0);if($0.version!==s.__version||i===!0){M.activeTexture($.TEXTURE0+v);let O0=r0.getPrimaries(r0.workingColorSpace),Z0=F.colorSpace===e5?null:r0.getPrimaries(F.colorSpace),P0=F.colorSpace===e5||O0===Z0?$.NONE:$.BROWSER_DEFAULT_WEBGL;$.pixelStorei($.UNPACK_FLIP_Y_WEBGL,F.flipY),$.pixelStorei($.UNPACK_PREMULTIPLY_ALPHA_WEBGL,F.premultiplyAlpha),$.pixelStorei($.UNPACK_ALIGNMENT,F.unpackAlignment),$.pixelStorei($.UNPACK_COLORSPACE_CONVERSION_WEBGL,P0);let S0=F.isCompressedTexture||F.image[0].isCompressedTexture,k0=F.image[0]&&F.image[0].isDataTexture,U0=[];for(let r=0;r<6;r++){if(!S0&&!k0)U0[r]=q(F.image[r],!0,H.maxCubemapSize);else U0[r]=k0?F.image[r].image:F.image[r];U0[r]=o0(F,U0[r])}let C0=U0[0],I0=k.convert(F.format,F.colorSpace),_=k.convert(F.type),n=D(F.internalFormat,I0,_,F.colorSpace),C=F.isVideoTexture!==!0,o=s.__version===void 0||i===!0,J0=$0.dataReady,W0=h(F,C0);v0($.TEXTURE_CUBE_MAP,F);let M0;if(S0){if(C&&o)M.texStorage2D($.TEXTURE_CUBE_MAP,W0,n,C0.width,C0.height);for(let r=0;r<6;r++){M0=U0[r].mipmaps;for(let V0=0;V0<M0.length;V0++){let b0=M0[V0];if(F.format!==J5)if(I0!==null)if(C){if(J0)M.compressedTexSubImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+r,V0,0,0,b0.width,b0.height,I0,b0.data)}else M.compressedTexImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+r,V0,n,b0.width,b0.height,0,b0.data);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()");else if(C){if(J0)M.texSubImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+r,V0,0,0,b0.width,b0.height,I0,_,b0.data)}else M.texImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+r,V0,n,b0.width,b0.height,0,I0,_,b0.data)}}}else{if(M0=F.mipmaps,C&&o){if(M0.length>0)W0++;let r=M1(U0[0]);M.texStorage2D($.TEXTURE_CUBE_MAP,W0,n,r.width,r.height)}for(let r=0;r<6;r++)if(k0){if(C){if(J0)M.texSubImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+r,0,0,0,U0[r].width,U0[r].height,I0,_,U0[r].data)}else M.texImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+r,0,n,U0[r].width,U0[r].height,0,I0,_,U0[r].data);for(let V0=0;V0<M0.length;V0++){let s0=M0[V0].image[r].image;if(C){if(J0)M.texSubImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+r,V0+1,0,0,s0.width,s0.height,I0,_,s0.data)}else M.texImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+r,V0+1,n,s0.width,s0.height,0,I0,_,s0.data)}}else{if(C){if(J0)M.texSubImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+r,0,0,0,I0,_,U0[r])}else M.texImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+r,0,n,I0,_,U0[r]);for(let V0=0;V0<M0.length;V0++){let b0=M0[V0];if(C){if(J0)M.texSubImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+r,V0+1,0,0,I0,_,b0.image[r])}else M.texImage2D($.TEXTURE_CUBE_MAP_POSITIVE_X+r,V0+1,n,I0,_,b0.image[r])}}}if(Y(F))N($.TEXTURE_CUBE_MAP);if(s.__version=$0.version,F.onUpdate)F.onUpdate(F)}I.__version=F.version}function E0(I,F,v,i,$0,s){let O0=k.convert(v.format,v.colorSpace),Z0=k.convert(v.type),P0=D(v.internalFormat,O0,Z0,v.colorSpace),S0=Q.get(F),k0=Q.get(v);if(k0.__renderTarget=F,!S0.__hasExternalTextures){let U0=Math.max(1,F.width>>s),C0=Math.max(1,F.height>>s);if($0===$.TEXTURE_3D||$0===$.TEXTURE_2D_ARRAY)M.texImage3D($0,s,P0,U0,C0,F.depth,0,O0,Z0,null);else M.texImage2D($0,s,P0,U0,C0,0,O0,Z0,null)}if(M.bindFramebuffer($.FRAMEBUFFER,I),z0(F))w.framebufferTexture2DMultisampleEXT($.FRAMEBUFFER,i,$0,k0.__webglTexture,0,N0(F));else if($0===$.TEXTURE_2D||$0>=$.TEXTURE_CUBE_MAP_POSITIVE_X&&$0<=$.TEXTURE_CUBE_MAP_NEGATIVE_Z)$.framebufferTexture2D($.FRAMEBUFFER,i,$0,k0.__webglTexture,s);M.bindFramebuffer($.FRAMEBUFFER,null)}function T0(I,F,v){if($.bindRenderbuffer($.RENDERBUFFER,I),F.depthBuffer){let i=F.depthTexture,$0=i&&i.isDepthTexture?i.type:null,s=P(F.stencilBuffer,$0),O0=F.stencilBuffer?$.DEPTH_STENCIL_ATTACHMENT:$.DEPTH_ATTACHMENT,Z0=N0(F);if(z0(F))w.renderbufferStorageMultisampleEXT($.RENDERBUFFER,Z0,s,F.width,F.height);else if(v)$.renderbufferStorageMultisample($.RENDERBUFFER,Z0,s,F.width,F.height);else $.renderbufferStorage($.RENDERBUFFER,s,F.width,F.height);$.framebufferRenderbuffer($.FRAMEBUFFER,O0,$.RENDERBUFFER,I)}else{let i=F.textures;for(let $0=0;$0<i.length;$0++){let s=i[$0],O0=k.convert(s.format,s.colorSpace),Z0=k.convert(s.type),P0=D(s.internalFormat,O0,Z0,s.colorSpace),S0=N0(F);if(v&&z0(F)===!1)$.renderbufferStorageMultisample($.RENDERBUFFER,S0,P0,F.width,F.height);else if(z0(F))w.renderbufferStorageMultisampleEXT($.RENDERBUFFER,S0,P0,F.width,F.height);else $.renderbufferStorage($.RENDERBUFFER,P0,F.width,F.height)}}$.bindRenderbuffer($.RENDERBUFFER,null)}function h0(I,F){if(F&&F.isWebGLCubeRenderTarget)throw Error("Depth Texture with cube render targets is not supported");if(M.bindFramebuffer($.FRAMEBUFFER,I),!(F.depthTexture&&F.depthTexture.isDepthTexture))throw Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");let i=Q.get(F.depthTexture);if(i.__renderTarget=F,!i.__webglTexture||F.depthTexture.image.width!==F.width||F.depthTexture.image.height!==F.height)F.depthTexture.image.width=F.width,F.depthTexture.image.height=F.height,F.depthTexture.needsUpdate=!0;t(F.depthTexture,0);let $0=i.__webglTexture,s=N0(F);if(F.depthTexture.format===Y$)if(z0(F))w.framebufferTexture2DMultisampleEXT($.FRAMEBUFFER,$.DEPTH_ATTACHMENT,$.TEXTURE_2D,$0,0,s);else $.framebufferTexture2D($.FRAMEBUFFER,$.DEPTH_ATTACHMENT,$.TEXTURE_2D,$0,0);else if(F.depthTexture.format===U6)if(z0(F))w.framebufferTexture2DMultisampleEXT($.FRAMEBUFFER,$.DEPTH_STENCIL_ATTACHMENT,$.TEXTURE_2D,$0,0,s);else $.framebufferTexture2D($.FRAMEBUFFER,$.DEPTH_STENCIL_ATTACHMENT,$.TEXTURE_2D,$0,0);else throw Error("Unknown depthTexture format")}function _0(I){let F=Q.get(I),v=I.isWebGLCubeRenderTarget===!0;if(F.__boundDepthTexture!==I.depthTexture){let i=I.depthTexture;if(F.__depthDisposeCallback)F.__depthDisposeCallback();if(i){let $0=()=>{delete F.__boundDepthTexture,delete F.__depthDisposeCallback,i.removeEventListener("dispose",$0)};i.addEventListener("dispose",$0),F.__depthDisposeCallback=$0}F.__boundDepthTexture=i}if(I.depthTexture&&!F.__autoAllocateDepthBuffer){if(v)throw Error("target.depthTexture not supported in Cube render targets");let i=I.texture.mipmaps;if(i&&i.length>0)h0(F.__webglFramebuffer[0],I);else h0(F.__webglFramebuffer,I)}else if(v){F.__webglDepthbuffer=[];for(let i=0;i<6;i++)if(M.bindFramebuffer($.FRAMEBUFFER,F.__webglFramebuffer[i]),F.__webglDepthbuffer[i]===void 0)F.__webglDepthbuffer[i]=$.createRenderbuffer(),T0(F.__webglDepthbuffer[i],I,!1);else{let $0=I.stencilBuffer?$.DEPTH_STENCIL_ATTACHMENT:$.DEPTH_ATTACHMENT,s=F.__webglDepthbuffer[i];$.bindRenderbuffer($.RENDERBUFFER,s),$.framebufferRenderbuffer($.FRAMEBUFFER,$0,$.RENDERBUFFER,s)}}else{let i=I.texture.mipmaps;if(i&&i.length>0)M.bindFramebuffer($.FRAMEBUFFER,F.__webglFramebuffer[0]);else M.bindFramebuffer($.FRAMEBUFFER,F.__webglFramebuffer);if(F.__webglDepthbuffer===void 0)F.__webglDepthbuffer=$.createRenderbuffer(),T0(F.__webglDepthbuffer,I,!1);else{let $0=I.stencilBuffer?$.DEPTH_STENCIL_ATTACHMENT:$.DEPTH_ATTACHMENT,s=F.__webglDepthbuffer;$.bindRenderbuffer($.RENDERBUFFER,s),$.framebufferRenderbuffer($.FRAMEBUFFER,$0,$.RENDERBUFFER,s)}}M.bindFramebuffer($.FRAMEBUFFER,null)}function T(I,F,v){let i=Q.get(I);if(F!==void 0)E0(i.__webglFramebuffer,I,I.texture,$.COLOR_ATTACHMENT0,$.TEXTURE_2D,0);if(v!==void 0)_0(I)}function d0(I){let F=I.texture,v=Q.get(I),i=Q.get(F);I.addEventListener("dispose",S);let $0=I.textures,s=I.isWebGLCubeRenderTarget===!0,O0=$0.length>1;if(!O0){if(i.__webglTexture===void 0)i.__webglTexture=$.createTexture();i.__version=F.version,K.memory.textures++}if(s){v.__webglFramebuffer=[];for(let Z0=0;Z0<6;Z0++)if(F.mipmaps&&F.mipmaps.length>0){v.__webglFramebuffer[Z0]=[];for(let P0=0;P0<F.mipmaps.length;P0++)v.__webglFramebuffer[Z0][P0]=$.createFramebuffer()}else v.__webglFramebuffer[Z0]=$.createFramebuffer()}else{if(F.mipmaps&&F.mipmaps.length>0){v.__webglFramebuffer=[];for(let Z0=0;Z0<F.mipmaps.length;Z0++)v.__webglFramebuffer[Z0]=$.createFramebuffer()}else v.__webglFramebuffer=$.createFramebuffer();if(O0)for(let Z0=0,P0=$0.length;Z0<P0;Z0++){let S0=Q.get($0[Z0]);if(S0.__webglTexture===void 0)S0.__webglTexture=$.createTexture(),K.memory.textures++}if(I.samples>0&&z0(I)===!1){v.__webglMultisampledFramebuffer=$.createFramebuffer(),v.__webglColorRenderbuffer=[],M.bindFramebuffer($.FRAMEBUFFER,v.__webglMultisampledFramebuffer);for(let Z0=0;Z0<$0.length;Z0++){let P0=$0[Z0];v.__webglColorRenderbuffer[Z0]=$.createRenderbuffer(),$.bindRenderbuffer($.RENDERBUFFER,v.__webglColorRenderbuffer[Z0]);let S0=k.convert(P0.format,P0.colorSpace),k0=k.convert(P0.type),U0=D(P0.internalFormat,S0,k0,P0.colorSpace,I.isXRRenderTarget===!0),C0=N0(I);$.renderbufferStorageMultisample($.RENDERBUFFER,C0,U0,I.width,I.height),$.framebufferRenderbuffer($.FRAMEBUFFER,$.COLOR_ATTACHMENT0+Z0,$.RENDERBUFFER,v.__webglColorRenderbuffer[Z0])}if($.bindRenderbuffer($.RENDERBUFFER,null),I.depthBuffer)v.__webglDepthRenderbuffer=$.createRenderbuffer(),T0(v.__webglDepthRenderbuffer,I,!0);M.bindFramebuffer($.FRAMEBUFFER,null)}}if(s){M.bindTexture($.TEXTURE_CUBE_MAP,i.__webglTexture),v0($.TEXTURE_CUBE_MAP,F);for(let Z0=0;Z0<6;Z0++)if(F.mipmaps&&F.mipmaps.length>0)for(let P0=0;P0<F.mipmaps.length;P0++)E0(v.__webglFramebuffer[Z0][P0],I,F,$.COLOR_ATTACHMENT0,$.TEXTURE_CUBE_MAP_POSITIVE_X+Z0,P0);else E0(v.__webglFramebuffer[Z0],I,F,$.COLOR_ATTACHMENT0,$.TEXTURE_CUBE_MAP_POSITIVE_X+Z0,0);if(Y(F))N($.TEXTURE_CUBE_MAP);M.unbindTexture()}else if(O0){for(let Z0=0,P0=$0.length;Z0<P0;Z0++){let S0=$0[Z0],k0=Q.get(S0),U0=$.TEXTURE_2D;if(I.isWebGL3DRenderTarget||I.isWebGLArrayRenderTarget)U0=I.isWebGL3DRenderTarget?$.TEXTURE_3D:$.TEXTURE_2D_ARRAY;if(M.bindTexture(U0,k0.__webglTexture),v0(U0,S0),E0(v.__webglFramebuffer,I,S0,$.COLOR_ATTACHMENT0+Z0,U0,0),Y(S0))N(U0)}M.unbindTexture()}else{let Z0=$.TEXTURE_2D;if(I.isWebGL3DRenderTarget||I.isWebGLArrayRenderTarget)Z0=I.isWebGL3DRenderTarget?$.TEXTURE_3D:$.TEXTURE_2D_ARRAY;if(M.bindTexture(Z0,i.__webglTexture),v0(Z0,F),F.mipmaps&&F.mipmaps.length>0)for(let P0=0;P0<F.mipmaps.length;P0++)E0(v.__webglFramebuffer[P0],I,F,$.COLOR_ATTACHMENT0,Z0,P0);else E0(v.__webglFramebuffer,I,F,$.COLOR_ATTACHMENT0,Z0,0);if(Y(F))N(Z0);M.unbindTexture()}if(I.depthBuffer)_0(I)}function F0(I){let F=I.textures;for(let v=0,i=F.length;v<i;v++){let $0=F[v];if(Y($0)){let s=V(I),O0=Q.get($0).__webglTexture;M.bindTexture(s,O0),N(s),M.unbindTexture()}}}let x0=[],q0=[];function n0(I){if(I.samples>0){if(z0(I)===!1){let{textures:F,width:v,height:i}=I,$0=$.COLOR_BUFFER_BIT,s=I.stencilBuffer?$.DEPTH_STENCIL_ATTACHMENT:$.DEPTH_ATTACHMENT,O0=Q.get(I),Z0=F.length>1;if(Z0)for(let S0=0;S0<F.length;S0++)M.bindFramebuffer($.FRAMEBUFFER,O0.__webglMultisampledFramebuffer),$.framebufferRenderbuffer($.FRAMEBUFFER,$.COLOR_ATTACHMENT0+S0,$.RENDERBUFFER,null),M.bindFramebuffer($.FRAMEBUFFER,O0.__webglFramebuffer),$.framebufferTexture2D($.DRAW_FRAMEBUFFER,$.COLOR_ATTACHMENT0+S0,$.TEXTURE_2D,null,0);M.bindFramebuffer($.READ_FRAMEBUFFER,O0.__webglMultisampledFramebuffer);let P0=I.texture.mipmaps;if(P0&&P0.length>0)M.bindFramebuffer($.DRAW_FRAMEBUFFER,O0.__webglFramebuffer[0]);else M.bindFramebuffer($.DRAW_FRAMEBUFFER,O0.__webglFramebuffer);for(let S0=0;S0<F.length;S0++){if(I.resolveDepthBuffer){if(I.depthBuffer)$0|=$.DEPTH_BUFFER_BIT;if(I.stencilBuffer&&I.resolveStencilBuffer)$0|=$.STENCIL_BUFFER_BIT}if(Z0){$.framebufferRenderbuffer($.READ_FRAMEBUFFER,$.COLOR_ATTACHMENT0,$.RENDERBUFFER,O0.__webglColorRenderbuffer[S0]);let k0=Q.get(F[S0]).__webglTexture;$.framebufferTexture2D($.DRAW_FRAMEBUFFER,$.COLOR_ATTACHMENT0,$.TEXTURE_2D,k0,0)}if($.blitFramebuffer(0,0,v,i,0,0,v,i,$0,$.NEAREST),W===!0){if(x0.length=0,q0.length=0,x0.push($.COLOR_ATTACHMENT0+S0),I.depthBuffer&&I.resolveDepthBuffer===!1)x0.push(s),q0.push(s),$.invalidateFramebuffer($.DRAW_FRAMEBUFFER,q0);$.invalidateFramebuffer($.READ_FRAMEBUFFER,x0)}}if(M.bindFramebuffer($.READ_FRAMEBUFFER,null),M.bindFramebuffer($.DRAW_FRAMEBUFFER,null),Z0)for(let S0=0;S0<F.length;S0++){M.bindFramebuffer($.FRAMEBUFFER,O0.__webglMultisampledFramebuffer),$.framebufferRenderbuffer($.FRAMEBUFFER,$.COLOR_ATTACHMENT0+S0,$.RENDERBUFFER,O0.__webglColorRenderbuffer[S0]);let k0=Q.get(F[S0]).__webglTexture;M.bindFramebuffer($.FRAMEBUFFER,O0.__webglFramebuffer),$.framebufferTexture2D($.DRAW_FRAMEBUFFER,$.COLOR_ATTACHMENT0+S0,$.TEXTURE_2D,k0,0)}M.bindFramebuffer($.DRAW_FRAMEBUFFER,O0.__webglMultisampledFramebuffer)}else if(I.depthBuffer&&I.resolveDepthBuffer===!1&&W){let F=I.stencilBuffer?$.DEPTH_STENCIL_ATTACHMENT:$.DEPTH_ATTACHMENT;$.invalidateFramebuffer($.DRAW_FRAMEBUFFER,[F])}}}function N0(I){return Math.min(H.maxSamples,I.samples)}function z0(I){let F=Q.get(I);return I.samples>0&&J.has("WEBGL_multisampled_render_to_texture")===!0&&F.__useRenderToTexture!==!1}function a0(I){let F=K.render.frame;if(R.get(I)!==F)R.set(I,F),I.update()}function o0(I,F){let{colorSpace:v,format:i,type:$0}=I;if(I.isCompressedTexture===!0||I.isVideoTexture===!0)return F;if(v!==Y6&&v!==e5)if(r0.getTransfer(v)===K1){if(i!==J5||$0!==N5)console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType.")}else console.error("THREE.WebGLTextures: Unsupported texture color space:",v);return F}function M1(I){if(typeof HTMLImageElement<"u"&&I instanceof HTMLImageElement)E.width=I.naturalWidth||I.width,E.height=I.naturalHeight||I.height;else if(typeof VideoFrame<"u"&&I instanceof VideoFrame)E.width=I.displayWidth,E.height=I.displayHeight;else E.width=I.width,E.height=I.height;return E}this.allocateTextureUnit=p,this.resetTextureUnits=g,this.setTexture2D=t,this.setTexture2DArray=m,this.setTexture3D=e,this.setTextureCube=d,this.rebindTextures=T,this.setupRenderTarget=d0,this.updateRenderTargetMipmap=F0,this.updateMultisampleRenderTarget=n0,this.setupDepthRenderbuffer=_0,this.setupFrameBufferTexture=E0,this.useMultisampledRTT=z0}function zE($,J){function M(Q,H=e5){let k,K=r0.getTransfer(H);if(Q===N5)return $.UNSIGNED_BYTE;if(Q===S9)return $.UNSIGNED_SHORT_4_4_4_4;if(Q===T9)return $.UNSIGNED_SHORT_5_5_5_1;if(Q===CM)return $.UNSIGNED_INT_5_9_9_9_REV;if(Q===BM)return $.BYTE;if(Q===IM)return $.SHORT;if(Q===Z6)return $.UNSIGNED_SHORT;if(Q===A9)return $.INT;if(Q===h8)return $.UNSIGNED_INT;if(Q===b5)return $.FLOAT;if(Q===R6)return $.HALF_FLOAT;if(Q===_M)return $.ALPHA;if(Q===AM)return $.RGB;if(Q===J5)return $.RGBA;if(Q===Y$)return $.DEPTH_COMPONENT;if(Q===U6)return $.DEPTH_STENCIL;if(Q===SM)return $.RED;if(Q===h9)return $.RED_INTEGER;if(Q===TM)return $.RG;if(Q===f9)return $.RG_INTEGER;if(Q===y9)return $.RGBA_INTEGER;if(Q===N$||Q===X$||Q===G$||Q===D$)if(K===K1)if(k=J.get("WEBGL_compressed_texture_s3tc_srgb"),k!==null){if(Q===N$)return k.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(Q===X$)return k.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(Q===G$)return k.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(Q===D$)return k.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(k=J.get("WEBGL_compressed_texture_s3tc"),k!==null){if(Q===N$)return k.COMPRESSED_RGB_S3TC_DXT1_EXT;if(Q===X$)return k.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(Q===G$)return k.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(Q===D$)return k.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(Q===j9||Q===v9||Q===b9||Q===p9)if(k=J.get("WEBGL_compressed_texture_pvrtc"),k!==null){if(Q===j9)return k.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(Q===v9)return k.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(Q===b9)return k.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(Q===p9)return k.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(Q===x9||Q===g9||Q===l9)if(k=J.get("WEBGL_compressed_texture_etc"),k!==null){if(Q===x9||Q===g9)return K===K1?k.COMPRESSED_SRGB8_ETC2:k.COMPRESSED_RGB8_ETC2;if(Q===l9)return K===K1?k.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:k.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(Q===d9||Q===m9||Q===u9||Q===c9||Q===n9||Q===s9||Q===o9||Q===i9||Q===r9||Q===a9||Q===t9||Q===e9||Q===$7||Q===J7)if(k=J.get("WEBGL_compressed_texture_astc"),k!==null){if(Q===d9)return K===K1?k.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:k.COMPRESSED_RGBA_ASTC_4x4_KHR;if(Q===m9)return K===K1?k.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:k.COMPRESSED_RGBA_ASTC_5x4_KHR;if(Q===u9)return K===K1?k.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:k.COMPRESSED_RGBA_ASTC_5x5_KHR;if(Q===c9)return K===K1?k.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:k.COMPRESSED_RGBA_ASTC_6x5_KHR;if(Q===n9)return K===K1?k.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:k.COMPRESSED_RGBA_ASTC_6x6_KHR;if(Q===s9)return K===K1?k.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:k.COMPRESSED_RGBA_ASTC_8x5_KHR;if(Q===o9)return K===K1?k.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:k.COMPRESSED_RGBA_ASTC_8x6_KHR;if(Q===i9)return K===K1?k.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:k.COMPRESSED_RGBA_ASTC_8x8_KHR;if(Q===r9)return K===K1?k.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:k.COMPRESSED_RGBA_ASTC_10x5_KHR;if(Q===a9)return K===K1?k.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:k.COMPRESSED_RGBA_ASTC_10x6_KHR;if(Q===t9)return K===K1?k.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:k.COMPRESSED_RGBA_ASTC_10x8_KHR;if(Q===e9)return K===K1?k.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:k.COMPRESSED_RGBA_ASTC_10x10_KHR;if(Q===$7)return K===K1?k.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:k.COMPRESSED_RGBA_ASTC_12x10_KHR;if(Q===J7)return K===K1?k.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:k.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(Q===q$||Q===M7||Q===Q7)if(k=J.get("EXT_texture_compression_bptc"),k!==null){if(Q===q$)return K===K1?k.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:k.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(Q===M7)return k.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(Q===Q7)return k.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(Q===hM||Q===H7||Q===k7||Q===K7)if(k=J.get("EXT_texture_compression_rgtc"),k!==null){if(Q===q$)return k.COMPRESSED_RED_RGTC1_EXT;if(Q===H7)return k.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(Q===k7)return k.COMPRESSED_RED_GREEN_RGTC2_EXT;if(Q===K7)return k.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;if(Q===f8)return $.UNSIGNED_INT_24_8;return $[Q]!==void 0?$[Q]:null}return{convert:M}}class m7 extends T1{constructor($=null){super();this.sourceTexture=$,this.isExternalTexture=!0}}var VE=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,BE=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class AQ{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init($,J){if(this.texture===null){let M=new m7($.texture);if($.depthNear!==J.depthNear||$.depthFar!==J.depthFar)this.depthNear=$.depthNear,this.depthFar=$.depthFar;this.texture=M}}getMesh($){if(this.texture!==null){if(this.mesh===null){let J=$.cameras[0].viewport,M=new Q5({vertexShader:VE,fragmentShader:BE,uniforms:{depthColor:{value:this.texture},depthWidth:{value:J.z},depthHeight:{value:J.w}}});this.mesh=new j1(new q6(20,20),M)}}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class SQ extends p5{constructor($,J){super();let M=this,Q=null,H=1,k=null,K="local-floor",w=1,W=null,E=null,R=null,Z=null,U=null,X=null,G=new AQ,q={},Y=J.getContextAttributes(),N=null,V=null,D=[],P=[],h=new J1,B=null,S=new L1;S.viewport=new U1;let b=new L1;b.viewport=new U1;let z=[S,b],O=new S7,f=null,g=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(c){let R0=D[c];if(R0===void 0)R0=new G6,D[c]=R0;return R0.getTargetRaySpace()},this.getControllerGrip=function(c){let R0=D[c];if(R0===void 0)R0=new G6,D[c]=R0;return R0.getGripSpace()},this.getHand=function(c){let R0=D[c];if(R0===void 0)R0=new G6,D[c]=R0;return R0.getHandSpace()};function p(c){let R0=P.indexOf(c.inputSource);if(R0===-1)return;let G0=D[R0];if(G0!==void 0)G0.update(c.inputSource,c.frame,W||k),G0.dispatchEvent({type:c.type,data:c.inputSource})}function u(){Q.removeEventListener("select",p),Q.removeEventListener("selectstart",p),Q.removeEventListener("selectend",p),Q.removeEventListener("squeeze",p),Q.removeEventListener("squeezestart",p),Q.removeEventListener("squeezeend",p),Q.removeEventListener("end",u),Q.removeEventListener("inputsourceschange",t);for(let c=0;c<D.length;c++){let R0=P[c];if(R0===null)continue;P[c]=null,D[c].disconnect(R0)}f=null,g=null,G.reset();for(let c in q)delete q[c];$.setRenderTarget(N),U=null,Z=null,R=null,Q=null,V=null,l0.stop(),M.isPresenting=!1,$.setPixelRatio(B),$.setSize(h.width,h.height,!1),M.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(c){if(H=c,M.isPresenting===!0)console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(c){if(K=c,M.isPresenting===!0)console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return W||k},this.setReferenceSpace=function(c){W=c},this.getBaseLayer=function(){return Z!==null?Z:U},this.getBinding=function(){return R},this.getFrame=function(){return X},this.getSession=function(){return Q},this.setSession=async function(c){if(Q=c,Q!==null){if(N=$.getRenderTarget(),Q.addEventListener("select",p),Q.addEventListener("selectstart",p),Q.addEventListener("selectend",p),Q.addEventListener("squeeze",p),Q.addEventListener("squeezestart",p),Q.addEventListener("squeezeend",p),Q.addEventListener("end",u),Q.addEventListener("inputsourceschange",t),Y.xrCompatible!==!0)await J.makeXRCompatible();if(B=$.getPixelRatio(),$.getSize(h),typeof XRWebGLBinding<"u")R=new XRWebGLBinding(Q,J);if(!(R!==null&&("createProjectionLayer"in XRWebGLBinding.prototype))){let G0={antialias:Y.antialias,alpha:!0,depth:Y.depth,stencil:Y.stencil,framebufferScaleFactor:H};U=new XRWebGLLayer(Q,J,G0),Q.updateRenderState({baseLayer:U}),$.setPixelRatio(1),$.setSize(U.framebufferWidth,U.framebufferHeight,!1),V=new M5(U.framebufferWidth,U.framebufferHeight,{format:J5,type:N5,colorSpace:$.outputColorSpace,stencilBuffer:Y.stencil,resolveDepthBuffer:U.ignoreDepthValues===!1,resolveStencilBuffer:U.ignoreDepthValues===!1})}else{let G0=null,H0=null,E0=null;if(Y.depth)E0=Y.stencil?J.DEPTH24_STENCIL8:J.DEPTH_COMPONENT24,G0=Y.stencil?U6:Y$,H0=Y.stencil?f8:h8;let T0={colorFormat:J.RGBA8,depthFormat:E0,scaleFactor:H};Z=R.createProjectionLayer(T0),Q.updateRenderState({layers:[Z]}),$.setPixelRatio(1),$.setSize(Z.textureWidth,Z.textureHeight,!1),V=new M5(Z.textureWidth,Z.textureHeight,{format:J5,type:N5,depthTexture:new v8(Z.textureWidth,Z.textureHeight,H0,void 0,void 0,void 0,void 0,void 0,void 0,G0),stencilBuffer:Y.stencil,colorSpace:$.outputColorSpace,samples:Y.antialias?4:0,resolveDepthBuffer:Z.ignoreDepthValues===!1,resolveStencilBuffer:Z.ignoreDepthValues===!1})}V.isXRRenderTarget=!0,this.setFoveation(w),W=null,k=await Q.requestReferenceSpace(K),l0.setContext(Q),l0.start(),M.isPresenting=!0,M.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(Q!==null)return Q.environmentBlendMode},this.getDepthTexture=function(){return G.getDepthTexture()};function t(c){for(let R0=0;R0<c.removed.length;R0++){let G0=c.removed[R0],H0=P.indexOf(G0);if(H0>=0)P[H0]=null,D[H0].disconnect(G0)}for(let R0=0;R0<c.added.length;R0++){let G0=c.added[R0],H0=P.indexOf(G0);if(H0===-1){for(let T0=0;T0<D.length;T0++)if(T0>=P.length){P.push(G0),H0=T0;break}else if(P[T0]===null){P[T0]=G0,H0=T0;break}if(H0===-1)break}let E0=D[H0];if(E0)E0.connect(G0)}}let m=new A,e=new A;function d(c,R0,G0){m.setFromMatrixPosition(R0.matrixWorld),e.setFromMatrixPosition(G0.matrixWorld);let H0=m.distanceTo(e),E0=R0.projectionMatrix.elements,T0=G0.projectionMatrix.elements,h0=E0[14]/(E0[10]-1),_0=E0[14]/(E0[10]+1),T=(E0[9]+1)/E0[5],d0=(E0[9]-1)/E0[5],F0=(E0[8]-1)/E0[0],x0=(T0[8]+1)/T0[0],q0=h0*F0,n0=h0*x0,N0=H0/(-F0+x0),z0=N0*-F0;if(R0.matrixWorld.decompose(c.position,c.quaternion,c.scale),c.translateX(z0),c.translateZ(N0),c.matrixWorld.compose(c.position,c.quaternion,c.scale),c.matrixWorldInverse.copy(c.matrixWorld).invert(),E0[10]===-1)c.projectionMatrix.copy(R0.projectionMatrix),c.projectionMatrixInverse.copy(R0.projectionMatrixInverse);else{let a0=h0+N0,o0=_0+N0,M1=q0-z0,I=n0+(H0-z0),F=T*_0/o0*a0,v=d0*_0/o0*a0;c.projectionMatrix.makePerspective(M1,I,F,v,a0,o0),c.projectionMatrixInverse.copy(c.projectionMatrix).invert()}}function Q0(c,R0){if(R0===null)c.matrixWorld.copy(c.matrix);else c.matrixWorld.multiplyMatrices(R0.matrixWorld,c.matrix);c.matrixWorldInverse.copy(c.matrixWorld).invert()}this.updateCamera=function(c){if(Q===null)return;let{near:R0,far:G0}=c;if(G.texture!==null){if(G.depthNear>0)R0=G.depthNear;if(G.depthFar>0)G0=G.depthFar}if(O.near=b.near=S.near=R0,O.far=b.far=S.far=G0,f!==O.near||g!==O.far)Q.updateRenderState({depthNear:O.near,depthFar:O.far}),f=O.near,g=O.far;O.layers.mask=c.layers.mask|6,S.layers.mask=O.layers.mask&3,b.layers.mask=O.layers.mask&5;let H0=c.parent,E0=O.cameras;Q0(O,H0);for(let T0=0;T0<E0.length;T0++)Q0(E0[T0],H0);if(E0.length===2)d(O,S,b);else O.projectionMatrix.copy(S.projectionMatrix);w0(c,O,H0)};function w0(c,R0,G0){if(G0===null)c.matrix.copy(R0.matrixWorld);else c.matrix.copy(G0.matrixWorld),c.matrix.invert(),c.matrix.multiply(R0.matrixWorld);if(c.matrix.decompose(c.position,c.quaternion,c.scale),c.updateMatrixWorld(!0),c.projectionMatrix.copy(R0.projectionMatrix),c.projectionMatrixInverse.copy(R0.projectionMatrixInverse),c.isPerspectiveCamera)c.fov=J$*2*Math.atan(1/c.projectionMatrix.elements[5]),c.zoom=1}this.getCamera=function(){return O},this.getFoveation=function(){if(Z===null&&U===null)return;return w},this.setFoveation=function(c){if(w=c,Z!==null)Z.fixedFoveation=c;if(U!==null&&U.fixedFoveation!==void 0)U.fixedFoveation=c},this.hasDepthSensing=function(){return G.texture!==null},this.getDepthSensingMesh=function(){return G.getMesh(O)},this.getCameraTexture=function(c){return q[c]};let D0=null;function v0(c,R0){if(E=R0.getViewerPose(W||k),X=R0,E!==null){let G0=E.views;if(U!==null)$.setRenderTargetFramebuffer(V,U.framebuffer),$.setRenderTarget(V);let H0=!1;if(G0.length!==O.cameras.length)O.cameras.length=0,H0=!0;for(let _0=0;_0<G0.length;_0++){let T=G0[_0],d0=null;if(U!==null)d0=U.getViewport(T);else{let x0=R.getViewSubImage(Z,T);if(d0=x0.viewport,_0===0)$.setRenderTargetTextures(V,x0.colorTexture,x0.depthStencilTexture),$.setRenderTarget(V)}let F0=z[_0];if(F0===void 0)F0=new L1,F0.layers.enable(_0),F0.viewport=new U1,z[_0]=F0;if(F0.matrix.fromArray(T.transform.matrix),F0.matrix.decompose(F0.position,F0.quaternion,F0.scale),F0.projectionMatrix.fromArray(T.projectionMatrix),F0.projectionMatrixInverse.copy(F0.projectionMatrix).invert(),F0.viewport.set(d0.x,d0.y,d0.width,d0.height),_0===0)O.matrix.copy(F0.matrix),O.matrix.decompose(O.position,O.quaternion,O.scale);if(H0===!0)O.cameras.push(F0)}let E0=Q.enabledFeatures;if(E0&&E0.includes("depth-sensing")&&Q.depthUsage=="gpu-optimized"&&R){let _0=R.getDepthInformation(G0[0]);if(_0&&_0.isValid&&_0.texture)G.init(_0,Q.renderState)}if(E0&&E0.includes("camera-access")){if($.state.unbindTexture(),R)for(let _0=0;_0<G0.length;_0++){let T=G0[_0].camera;if(T){let d0=q[T];if(!d0)d0=new m7,q[T]=d0;let F0=R.getCameraImage(T);d0.sourceTexture=F0}}}}for(let G0=0;G0<D.length;G0++){let H0=P[G0],E0=D[G0];if(H0!==null&&E0!==void 0)E0.update(H0,R0,W||k)}if(D0)D0(c,R0);if(R0.detectedPlanes)M.dispatchEvent({type:"planesdetected",data:R0});X=null}let l0=new OQ;l0.setAnimationLoop(v0),this.setAnimationLoop=function(c){D0=c},this.dispose=function(){}}}var K8=new u1,IE=new H1;function CE($,J){function M(Y,N){if(Y.matrixAutoUpdate===!0)Y.updateMatrix();N.value.copy(Y.matrix)}function Q(Y,N){if(N.color.getRGB(Y.fogColor.value,X7($)),N.isFog)Y.fogNear.value=N.near,Y.fogFar.value=N.far;else if(N.isFogExp2)Y.fogDensity.value=N.density}function H(Y,N,V,D,P){if(N.isMeshBasicMaterial)k(Y,N);else if(N.isMeshLambertMaterial)k(Y,N);else if(N.isMeshToonMaterial)k(Y,N),Z(Y,N);else if(N.isMeshPhongMaterial)k(Y,N),R(Y,N);else if(N.isMeshStandardMaterial){if(k(Y,N),U(Y,N),N.isMeshPhysicalMaterial)X(Y,N,P)}else if(N.isMeshMatcapMaterial)k(Y,N),G(Y,N);else if(N.isMeshDepthMaterial)k(Y,N);else if(N.isMeshDistanceMaterial)k(Y,N),q(Y,N);else if(N.isMeshNormalMaterial)k(Y,N);else if(N.isLineBasicMaterial){if(K(Y,N),N.isLineDashedMaterial)w(Y,N)}else if(N.isPointsMaterial)W(Y,N,V,D);else if(N.isSpriteMaterial)E(Y,N);else if(N.isShadowMaterial)Y.color.value.copy(N.color),Y.opacity.value=N.opacity;else if(N.isShaderMaterial)N.uniformsNeedUpdate=!1}function k(Y,N){if(Y.opacity.value=N.opacity,N.color)Y.diffuse.value.copy(N.color);if(N.emissive)Y.emissive.value.copy(N.emissive).multiplyScalar(N.emissiveIntensity);if(N.map)Y.map.value=N.map,M(N.map,Y.mapTransform);if(N.alphaMap)Y.alphaMap.value=N.alphaMap,M(N.alphaMap,Y.alphaMapTransform);if(N.bumpMap){if(Y.bumpMap.value=N.bumpMap,M(N.bumpMap,Y.bumpMapTransform),Y.bumpScale.value=N.bumpScale,N.side===c1)Y.bumpScale.value*=-1}if(N.normalMap){if(Y.normalMap.value=N.normalMap,M(N.normalMap,Y.normalMapTransform),Y.normalScale.value.copy(N.normalScale),N.side===c1)Y.normalScale.value.negate()}if(N.displacementMap)Y.displacementMap.value=N.displacementMap,M(N.displacementMap,Y.displacementMapTransform),Y.displacementScale.value=N.displacementScale,Y.displacementBias.value=N.displacementBias;if(N.emissiveMap)Y.emissiveMap.value=N.emissiveMap,M(N.emissiveMap,Y.emissiveMapTransform);if(N.specularMap)Y.specularMap.value=N.specularMap,M(N.specularMap,Y.specularMapTransform);if(N.alphaTest>0)Y.alphaTest.value=N.alphaTest;let V=J.get(N),D=V.envMap,P=V.envMapRotation;if(D){if(Y.envMap.value=D,K8.copy(P),K8.x*=-1,K8.y*=-1,K8.z*=-1,D.isCubeTexture&&D.isRenderTargetTexture===!1)K8.y*=-1,K8.z*=-1;Y.envMapRotation.value.setFromMatrix4(IE.makeRotationFromEuler(K8)),Y.flipEnvMap.value=D.isCubeTexture&&D.isRenderTargetTexture===!1?-1:1,Y.reflectivity.value=N.reflectivity,Y.ior.value=N.ior,Y.refractionRatio.value=N.refractionRatio}if(N.lightMap)Y.lightMap.value=N.lightMap,Y.lightMapIntensity.value=N.lightMapIntensity,M(N.lightMap,Y.lightMapTransform);if(N.aoMap)Y.aoMap.value=N.aoMap,Y.aoMapIntensity.value=N.aoMapIntensity,M(N.aoMap,Y.aoMapTransform)}function K(Y,N){if(Y.diffuse.value.copy(N.color),Y.opacity.value=N.opacity,N.map)Y.map.value=N.map,M(N.map,Y.mapTransform)}function w(Y,N){Y.dashSize.value=N.dashSize,Y.totalSize.value=N.dashSize+N.gapSize,Y.scale.value=N.scale}function W(Y,N,V,D){if(Y.diffuse.value.copy(N.color),Y.opacity.value=N.opacity,Y.size.value=N.size*V,Y.scale.value=D*0.5,N.map)Y.map.value=N.map,M(N.map,Y.uvTransform);if(N.alphaMap)Y.alphaMap.value=N.alphaMap,M(N.alphaMap,Y.alphaMapTransform);if(N.alphaTest>0)Y.alphaTest.value=N.alphaTest}function E(Y,N){if(Y.diffuse.value.copy(N.color),Y.opacity.value=N.opacity,Y.rotation.value=N.rotation,N.map)Y.map.value=N.map,M(N.map,Y.mapTransform);if(N.alphaMap)Y.alphaMap.value=N.alphaMap,M(N.alphaMap,Y.alphaMapTransform);if(N.alphaTest>0)Y.alphaTest.value=N.alphaTest}function R(Y,N){Y.specular.value.copy(N.specular),Y.shininess.value=Math.max(N.shininess,0.0001)}function Z(Y,N){if(N.gradientMap)Y.gradientMap.value=N.gradientMap}function U(Y,N){if(Y.metalness.value=N.metalness,N.metalnessMap)Y.metalnessMap.value=N.metalnessMap,M(N.metalnessMap,Y.metalnessMapTransform);if(Y.roughness.value=N.roughness,N.roughnessMap)Y.roughnessMap.value=N.roughnessMap,M(N.roughnessMap,Y.roughnessMapTransform);if(N.envMap)Y.envMapIntensity.value=N.envMapIntensity}function X(Y,N,V){if(Y.ior.value=N.ior,N.sheen>0){if(Y.sheenColor.value.copy(N.sheenColor).multiplyScalar(N.sheen),Y.sheenRoughness.value=N.sheenRoughness,N.sheenColorMap)Y.sheenColorMap.value=N.sheenColorMap,M(N.sheenColorMap,Y.sheenColorMapTransform);if(N.sheenRoughnessMap)Y.sheenRoughnessMap.value=N.sheenRoughnessMap,M(N.sheenRoughnessMap,Y.sheenRoughnessMapTransform)}if(N.clearcoat>0){if(Y.clearcoat.value=N.clearcoat,Y.clearcoatRoughness.value=N.clearcoatRoughness,N.clearcoatMap)Y.clearcoatMap.value=N.clearcoatMap,M(N.clearcoatMap,Y.clearcoatMapTransform);if(N.clearcoatRoughnessMap)Y.clearcoatRoughnessMap.value=N.clearcoatRoughnessMap,M(N.clearcoatRoughnessMap,Y.clearcoatRoughnessMapTransform);if(N.clearcoatNormalMap){if(Y.clearcoatNormalMap.value=N.clearcoatNormalMap,M(N.clearcoatNormalMap,Y.clearcoatNormalMapTransform),Y.clearcoatNormalScale.value.copy(N.clearcoatNormalScale),N.side===c1)Y.clearcoatNormalScale.value.negate()}}if(N.dispersion>0)Y.dispersion.value=N.dispersion;if(N.iridescence>0){if(Y.iridescence.value=N.iridescence,Y.iridescenceIOR.value=N.iridescenceIOR,Y.iridescenceThicknessMinimum.value=N.iridescenceThicknessRange[0],Y.iridescenceThicknessMaximum.value=N.iridescenceThicknessRange[1],N.iridescenceMap)Y.iridescenceMap.value=N.iridescenceMap,M(N.iridescenceMap,Y.iridescenceMapTransform);if(N.iridescenceThicknessMap)Y.iridescenceThicknessMap.value=N.iridescenceThicknessMap,M(N.iridescenceThicknessMap,Y.iridescenceThicknessMapTransform)}if(N.transmission>0){if(Y.transmission.value=N.transmission,Y.transmissionSamplerMap.value=V.texture,Y.transmissionSamplerSize.value.set(V.width,V.height),N.transmissionMap)Y.transmissionMap.value=N.transmissionMap,M(N.transmissionMap,Y.transmissionMapTransform);if(Y.thickness.value=N.thickness,N.thicknessMap)Y.thicknessMap.value=N.thicknessMap,M(N.thicknessMap,Y.thicknessMapTransform);Y.attenuationDistance.value=N.attenuationDistance,Y.attenuationColor.value.copy(N.attenuationColor)}if(N.anisotropy>0){if(Y.anisotropyVector.value.set(N.anisotropy*Math.cos(N.anisotropyRotation),N.anisotropy*Math.sin(N.anisotropyRotation)),N.anisotropyMap)Y.anisotropyMap.value=N.anisotropyMap,M(N.anisotropyMap,Y.anisotropyMapTransform)}if(Y.specularIntensity.value=N.specularIntensity,Y.specularColor.value.copy(N.specularColor),N.specularColorMap)Y.specularColorMap.value=N.specularColorMap,M(N.specularColorMap,Y.specularColorMapTransform);if(N.specularIntensityMap)Y.specularIntensityMap.value=N.specularIntensityMap,M(N.specularIntensityMap,Y.specularIntensityMapTransform)}function G(Y,N){if(N.matcap)Y.matcap.value=N.matcap}function q(Y,N){let V=J.get(N).light;Y.referencePosition.value.setFromMatrixPosition(V.matrixWorld),Y.nearDistance.value=V.shadow.camera.near,Y.farDistance.value=V.shadow.camera.far}return{refreshFogUniforms:Q,refreshMaterialUniforms:H}}function _E($,J,M,Q){let H={},k={},K=[],w=$.getParameter($.MAX_UNIFORM_BUFFER_BINDINGS);function W(V,D){let P=D.program;Q.uniformBlockBinding(V,P)}function E(V,D){let P=H[V.id];if(P===void 0)G(V),P=R(V),H[V.id]=P,V.addEventListener("dispose",Y);let h=D.program;Q.updateUBOMapping(V,h);let B=J.render.frame;if(k[V.id]!==B)U(V),k[V.id]=B}function R(V){let D=Z();V.__bindingPointIndex=D;let P=$.createBuffer(),h=V.__size,B=V.usage;return $.bindBuffer($.UNIFORM_BUFFER,P),$.bufferData($.UNIFORM_BUFFER,h,B),$.bindBuffer($.UNIFORM_BUFFER,null),$.bindBufferBase($.UNIFORM_BUFFER,D,P),P}function Z(){for(let V=0;V<w;V++)if(K.indexOf(V)===-1)return K.push(V),V;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function U(V){let D=H[V.id],P=V.uniforms,h=V.__cache;$.bindBuffer($.UNIFORM_BUFFER,D);for(let B=0,S=P.length;B<S;B++){let b=Array.isArray(P[B])?P[B]:[P[B]];for(let z=0,O=b.length;z<O;z++){let f=b[z];if(X(f,B,z,h)===!0){let g=f.__offset,p=Array.isArray(f.value)?f.value:[f.value],u=0;for(let t=0;t<p.length;t++){let m=p[t],e=q(m);if(typeof m==="number"||typeof m==="boolean")f.__data[0]=m,$.bufferSubData($.UNIFORM_BUFFER,g+u,f.__data);else if(m.isMatrix3)f.__data[0]=m.elements[0],f.__data[1]=m.elements[1],f.__data[2]=m.elements[2],f.__data[3]=0,f.__data[4]=m.elements[3],f.__data[5]=m.elements[4],f.__data[6]=m.elements[5],f.__data[7]=0,f.__data[8]=m.elements[6],f.__data[9]=m.elements[7],f.__data[10]=m.elements[8],f.__data[11]=0;else m.toArray(f.__data,u),u+=e.storage/Float32Array.BYTES_PER_ELEMENT}$.bufferSubData($.UNIFORM_BUFFER,g,f.__data)}}}$.bindBuffer($.UNIFORM_BUFFER,null)}function X(V,D,P,h){let B=V.value,S=D+"_"+P;if(h[S]===void 0){if(typeof B==="number"||typeof B==="boolean")h[S]=B;else h[S]=B.clone();return!0}else{let b=h[S];if(typeof B==="number"||typeof B==="boolean"){if(b!==B)return h[S]=B,!0}else if(b.equals(B)===!1)return b.copy(B),!0}return!1}function G(V){let D=V.uniforms,P=0,h=16;for(let S=0,b=D.length;S<b;S++){let z=Array.isArray(D[S])?D[S]:[D[S]];for(let O=0,f=z.length;O<f;O++){let g=z[O],p=Array.isArray(g.value)?g.value:[g.value];for(let u=0,t=p.length;u<t;u++){let m=p[u],e=q(m),d=P%h,Q0=d%e.boundary,w0=d+Q0;if(P+=Q0,w0!==0&&h-w0<e.storage)P+=h-w0;g.__data=new Float32Array(e.storage/Float32Array.BYTES_PER_ELEMENT),g.__offset=P,P+=e.storage}}}let B=P%h;if(B>0)P+=h-B;return V.__size=P,V.__cache={},this}function q(V){let D={boundary:0,storage:0};if(typeof V==="number"||typeof V==="boolean")D.boundary=4,D.storage=4;else if(V.isVector2)D.boundary=8,D.storage=8;else if(V.isVector3||V.isColor)D.boundary=16,D.storage=12;else if(V.isVector4)D.boundary=16,D.storage=16;else if(V.isMatrix3)D.boundary=48,D.storage=48;else if(V.isMatrix4)D.boundary=64,D.storage=64;else if(V.isTexture)console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group.");else console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",V);return D}function Y(V){let D=V.target;D.removeEventListener("dispose",Y);let P=K.indexOf(D.__bindingPointIndex);K.splice(P,1),$.deleteBuffer(H[D.id]),delete H[D.id],delete k[D.id]}function N(){for(let V in H)$.deleteBuffer(H[V]);K=[],H={},k={}}return{bind:W,update:E,dispose:N}}class u7{constructor($={}){let{canvas:J=uM(),context:M=null,depth:Q=!0,stencil:H=!1,alpha:k=!1,antialias:K=!1,premultipliedAlpha:w=!0,preserveDrawingBuffer:W=!1,powerPreference:E="default",failIfMajorPerformanceCaveat:R=!1,reversedDepthBuffer:Z=!1}=$;this.isWebGLRenderer=!0;let U;if(M!==null){if(typeof WebGLRenderingContext<"u"&&M instanceof WebGLRenderingContext)throw Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");U=M.getContextAttributes().alpha}else U=k;let X=new Uint32Array(4),G=new Int32Array(4),q=null,Y=null,N=[],V=[];this.domElement=J,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=I5,this.toneMappingExposure=1,this.transmissionResolutionScale=1;let D=this,P=!1;this._outputColorSpace=vM;let h=0,B=0,S=null,b=-1,z=null,O=new U1,f=new U1,g=null,p=new e0(0),u=0,t=J.width,m=J.height,e=1,d=null,Q0=null,w0=new U1(0,0,t,m),D0=new U1(0,0,t,m),v0=!1,l0=new C$,c=!1,R0=!1,G0=new H1,H0=new A,E0=new U1,T0={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0},h0=!1;function _0(){return S===null?e:1}let T=M;function d0(L,y){return J.getContext(L,y)}try{let L={alpha:!0,depth:Q,stencil:H,antialias:K,premultipliedAlpha:w,preserveDrawingBuffer:W,powerPreference:E,failIfMajorPerformanceCaveat:R};if("setAttribute"in J)J.setAttribute("data-engine",`three.js r${lJ}`);if(J.addEventListener("webglcontextlost",o,!1),J.addEventListener("webglcontextrestored",J0,!1),J.addEventListener("webglcontextcreationerror",W0,!1),T===null){if(T=d0("webgl2",L),T===null)if(d0("webgl2"))throw Error("Error creating WebGL context with your selected attributes.");else throw Error("Error creating WebGL context.")}}catch(L){throw console.error("THREE.WebGLRenderer: "+L.message),L}let F0,x0,q0,n0,N0,z0,a0,o0,M1,I,F,v,i,$0,s,O0,Z0,P0,S0,k0,U0,C0,I0,_;function n(){if(F0=new nw(T),F0.init(),C0=new zE(T,F0),x0=new xw(T,F0,$,C0),q0=new LE(T,F0),x0.reversedDepthBuffer&&Z)q0.buffers.depth.setReversed(!0);n0=new iw(T),N0=new WE,z0=new PE(T,F0,q0,N0,x0,C0,n0),a0=new lw(D),o0=new cw(D),M1=new Jk(T),I0=new bw(T,M1),I=new sw(T,M1,n0,I0),F=new aw(T,I,M1,n0),S0=new rw(T,x0,z0),O0=new gw(N0),v=new wE(D,a0,o0,F0,x0,I0,O0),i=new CE(D,N0),$0=new ZE,s=new GE(F0),P0=new vw(D,a0,o0,q0,F,U,w),Z0=new OE(D,F,x0),_=new _E(T,n0,x0,q0),k0=new pw(T,F0,n0),U0=new ow(T,F0,n0),n0.programs=v.programs,D.capabilities=x0,D.extensions=F0,D.properties=N0,D.renderLists=$0,D.shadowMap=Z0,D.state=q0,D.info=n0}n();let C=new SQ(D,T);this.xr=C,this.getContext=function(){return T},this.getContextAttributes=function(){return T.getContextAttributes()},this.forceContextLoss=function(){let L=F0.get("WEBGL_lose_context");if(L)L.loseContext()},this.forceContextRestore=function(){let L=F0.get("WEBGL_lose_context");if(L)L.restoreContext()},this.getPixelRatio=function(){return e},this.setPixelRatio=function(L){if(L===void 0)return;e=L,this.setSize(t,m,!1)},this.getSize=function(L){return L.set(t,m)},this.setSize=function(L,y,x=!0){if(C.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}if(t=L,m=y,J.width=Math.floor(L*e),J.height=Math.floor(y*e),x===!0)J.style.width=L+"px",J.style.height=y+"px";this.setViewport(0,0,L,y)},this.getDrawingBufferSize=function(L){return L.set(t*e,m*e).floor()},this.setDrawingBufferSize=function(L,y,x){t=L,m=y,e=x,J.width=Math.floor(L*x),J.height=Math.floor(y*x),this.setViewport(0,0,L,y)},this.getCurrentViewport=function(L){return L.copy(O)},this.getViewport=function(L){return L.copy(w0)},this.setViewport=function(L,y,x,l){if(L.isVector4)w0.set(L.x,L.y,L.z,L.w);else w0.set(L,y,x,l);q0.viewport(O.copy(w0).multiplyScalar(e).round())},this.getScissor=function(L){return L.copy(D0)},this.setScissor=function(L,y,x,l){if(L.isVector4)D0.set(L.x,L.y,L.z,L.w);else D0.set(L,y,x,l);q0.scissor(f.copy(D0).multiplyScalar(e).round())},this.getScissorTest=function(){return v0},this.setScissorTest=function(L){q0.setScissorTest(v0=L)},this.setOpaqueSort=function(L){d=L},this.setTransparentSort=function(L){Q0=L},this.getClearColor=function(L){return L.copy(P0.getClearColor())},this.setClearColor=function(){P0.setClearColor(...arguments)},this.getClearAlpha=function(){return P0.getClearAlpha()},this.setClearAlpha=function(){P0.setClearAlpha(...arguments)},this.clear=function(L=!0,y=!0,x=!0){let l=0;if(L){let j=!1;if(S!==null){let K0=S.texture.format;j=K0===y9||K0===f9||K0===h9}if(j){let K0=S.texture.type,X0=K0===N5||K0===h8||K0===Z6||K0===f8||K0===S9||K0===T9,B0=P0.getClearColor(),L0=P0.getClearAlpha(),y0=B0.r,j0=B0.g,A0=B0.b;if(X0)X[0]=y0,X[1]=j0,X[2]=A0,X[3]=L0,T.clearBufferuiv(T.COLOR,0,X);else G[0]=y0,G[1]=j0,G[2]=A0,G[3]=L0,T.clearBufferiv(T.COLOR,0,G)}else l|=T.COLOR_BUFFER_BIT}if(y)l|=T.DEPTH_BUFFER_BIT;if(x)l|=T.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295);T.clear(l)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){J.removeEventListener("webglcontextlost",o,!1),J.removeEventListener("webglcontextrestored",J0,!1),J.removeEventListener("webglcontextcreationerror",W0,!1),P0.dispose(),$0.dispose(),s.dispose(),N0.dispose(),a0.dispose(),o0.dispose(),F.dispose(),I0.dispose(),_.dispose(),v.dispose(),C.dispose(),C.removeEventListener("sessionstart",O1),C.removeEventListener("sessionend",V1),A5.stop()};function o(L){L.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),P=!0}function J0(){console.log("THREE.WebGLRenderer: Context Restored."),P=!1;let L=n0.autoReset,y=Z0.enabled,x=Z0.autoUpdate,l=Z0.needsUpdate,j=Z0.type;n(),n0.autoReset=L,Z0.enabled=y,Z0.autoUpdate=x,Z0.needsUpdate=l,Z0.type=j}function W0(L){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",L.statusMessage)}function M0(L){let y=L.target;y.removeEventListener("dispose",M0),r(y)}function r(L){V0(L),N0.remove(L)}function V0(L){let y=N0.get(L).programs;if(y!==void 0){if(y.forEach(function(x){v.releaseProgram(x)}),L.isShaderMaterial)v.releaseShaderCache(L)}}this.renderBufferDirect=function(L,y,x,l,j,K0){if(y===null)y=T0;let X0=j.isMesh&&j.matrixWorld.determinant()<0,B0=DH(L,y,x,l,j);q0.setMaterial(l,X0);let L0=x.index,y0=1;if(l.wireframe===!0){if(L0=I.getWireframeAttribute(x),L0===void 0)return;y0=2}let j0=x.drawRange,A0=x.attributes.position,u0=j0.start*y0,Q1=(j0.start+j0.count)*y0;if(K0!==null)u0=Math.max(u0,K0.start*y0),Q1=Math.min(Q1,(K0.start+K0.count)*y0);if(L0!==null)u0=Math.max(u0,0),Q1=Math.min(Q1,L0.count);else if(A0!==void 0&&A0!==null)u0=Math.max(u0,0),Q1=Math.min(Q1,A0.count);let R1=Q1-u0;if(R1<0||R1===1/0)return;I0.setup(j,l,B0,x,L0);let w1,k1=k0;if(L0!==null)w1=M1.get(L0),k1=U0,k1.setIndex(w1);if(j.isMesh)if(l.wireframe===!0)q0.setLineWidth(l.wireframeLinewidth*_0()),k1.setMode(T.LINES);else k1.setMode(T.TRIANGLES);else if(j.isLine){let f0=l.linewidth;if(f0===void 0)f0=1;if(q0.setLineWidth(f0*_0()),j.isLineSegments)k1.setMode(T.LINES);else if(j.isLineLoop)k1.setMode(T.LINE_LOOP);else k1.setMode(T.LINE_STRIP)}else if(j.isPoints)k1.setMode(T.POINTS);else if(j.isSprite)k1.setMode(T.TRIANGLES);if(j.isBatchedMesh)if(j._multiDrawInstances!==null)r5("THREE.WebGLRenderer: renderMultiDrawInstances has been deprecated and will be removed in r184. Append to renderMultiDraw arguments and use indirection."),k1.renderMultiDrawInstances(j._multiDrawStarts,j._multiDrawCounts,j._multiDrawCount,j._multiDrawInstances);else if(!F0.get("WEBGL_multi_draw")){let{_multiDrawStarts:f0,_multiDrawCounts:E1,_multiDrawCount:t0}=j,x1=L0?M1.get(L0).bytesPerElement:1,Y8=N0.get(l).currentProgram.getUniforms();for(let g1=0;g1<t0;g1++)Y8.setValue(T,"_gl_DrawID",g1),k1.render(f0[g1]/x1,E1[g1])}else k1.renderMultiDraw(j._multiDrawStarts,j._multiDrawCounts,j._multiDrawCount);else if(j.isInstancedMesh)k1.renderInstances(u0,R1,j.count);else if(x.isInstancedBufferGeometry){let f0=x._maxInstanceCount!==void 0?x._maxInstanceCount:1/0,E1=Math.min(x.instanceCount,f0);k1.renderInstances(u0,R1,E1)}else k1.render(u0,R1)};function b0(L,y,x){if(L.transparent===!0&&L.side===n1&&L.forceSinglePass===!1)L.side=c1,L.needsUpdate=!0,y6(L,y,x),L.side=Y5,L.needsUpdate=!0,y6(L,y,x),L.side=n1;else y6(L,y,x)}this.compile=function(L,y,x=null){if(x===null)x=L;if(Y=s.get(x),Y.init(y),V.push(Y),x.traverseVisible(function(j){if(j.isLight&&j.layers.test(y.layers)){if(Y.pushLight(j),j.castShadow)Y.pushShadow(j)}}),L!==x)L.traverseVisible(function(j){if(j.isLight&&j.layers.test(y.layers)){if(Y.pushLight(j),j.castShadow)Y.pushShadow(j)}});Y.setupLights();let l=new Set;return L.traverse(function(j){if(!(j.isMesh||j.isPoints||j.isLine||j.isSprite))return;let K0=j.material;if(K0)if(Array.isArray(K0))for(let X0=0;X0<K0.length;X0++){let B0=K0[X0];b0(B0,x,j),l.add(B0)}else b0(K0,x,j),l.add(K0)}),Y=V.pop(),l},this.compileAsync=function(L,y,x=null){let l=this.compile(L,y,x);return new Promise((j)=>{function K0(){if(l.forEach(function(X0){if(N0.get(X0).currentProgram.isReady())l.delete(X0)}),l.size===0){j(L);return}setTimeout(K0,10)}if(F0.get("KHR_parallel_shader_compile")!==null)K0();else setTimeout(K0,10)})};let s0=null;function i0(L){if(s0)s0(L)}function O1(){A5.stop()}function V1(){A5.start()}let A5=new OQ;if(A5.setAnimationLoop(i0),typeof self<"u")A5.setContext(self);this.setAnimationLoop=function(L){s0=L,C.setAnimationLoop(L),L===null?A5.stop():A5.start()},C.addEventListener("sessionstart",O1),C.addEventListener("sessionend",V1),this.render=function(L,y){if(y!==void 0&&y.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(P===!0)return;if(L.matrixWorldAutoUpdate===!0)L.updateMatrixWorld();if(y.parent===null&&y.matrixWorldAutoUpdate===!0)y.updateMatrixWorld();if(C.enabled===!0&&C.isPresenting===!0){if(C.cameraAutoUpdate===!0)C.updateCamera(y);y=C.getCamera()}if(L.isScene===!0)L.onBeforeRender(D,L,y,S);if(Y=s.get(L,V.length),Y.init(y),V.push(Y),G0.multiplyMatrices(y.projectionMatrix,y.matrixWorldInverse),l0.setFromProjectionMatrix(G0,Z7,y.reversedDepth),R0=this.localClippingEnabled,c=O0.init(this.clippingPlanes,R0),q=$0.get(L,N.length),q.init(),N.push(q),C.enabled===!0&&C.isPresenting===!0){let K0=D.xr.getDepthSensingMesh();if(K0!==null)O5(K0,y,-1/0,D.sortObjects)}if(O5(L,y,0,D.sortObjects),q.finish(),D.sortObjects===!0)q.sort(d,Q0);if(h0=C.enabled===!1||C.isPresenting===!1||C.hasDepthSensing()===!1,h0)P0.addToRenderList(q,L);if(this.info.render.frame++,c===!0)O0.beginShadows();let x=Y.state.shadowsArray;if(Z0.render(x,L,y),c===!0)O0.endShadows();if(this.info.autoReset===!0)this.info.reset();let{opaque:l,transmissive:j}=q;if(Y.setupLights(),y.isArrayCamera){let K0=y.cameras;if(j.length>0)for(let X0=0,B0=K0.length;X0<B0;X0++){let L0=K0[X0];GJ(l,j,L,L0)}if(h0)P0.render(L);for(let X0=0,B0=K0.length;X0<B0;X0++){let L0=K0[X0];XJ(q,L,L0,L0.viewport)}}else{if(j.length>0)GJ(l,j,L,y);if(h0)P0.render(L);XJ(q,L,y)}if(S!==null&&B===0)z0.updateMultisampleRenderTarget(S),z0.updateRenderTargetMipmap(S);if(L.isScene===!0)L.onAfterRender(D,L,y);if(I0.resetDefaultState(),b=-1,z=null,V.pop(),V.length>0){if(Y=V[V.length-1],c===!0)O0.setGlobalState(D.clippingPlanes,Y.state.camera)}else Y=null;if(N.pop(),N.length>0)q=N[N.length-1];else q=null};function O5(L,y,x,l){if(L.visible===!1)return;if(L.layers.test(y.layers)){if(L.isGroup)x=L.renderOrder;else if(L.isLOD){if(L.autoUpdate===!0)L.update(y)}else if(L.isLight){if(Y.pushLight(L),L.castShadow)Y.pushShadow(L)}else if(L.isSprite){if(!L.frustumCulled||l0.intersectsSprite(L)){if(l)E0.setFromMatrixPosition(L.matrixWorld).applyMatrix4(G0);let X0=F.update(L),B0=L.material;if(B0.visible)q.push(L,X0,B0,x,E0.z,null)}}else if(L.isMesh||L.isLine||L.isPoints){if(!L.frustumCulled||l0.intersectsObject(L)){let X0=F.update(L),B0=L.material;if(l){if(L.boundingSphere!==void 0){if(L.boundingSphere===null)L.computeBoundingSphere();E0.copy(L.boundingSphere.center)}else{if(X0.boundingSphere===null)X0.computeBoundingSphere();E0.copy(X0.boundingSphere.center)}E0.applyMatrix4(L.matrixWorld).applyMatrix4(G0)}if(Array.isArray(B0)){let L0=X0.groups;for(let y0=0,j0=L0.length;y0<j0;y0++){let A0=L0[y0],u0=B0[A0.materialIndex];if(u0&&u0.visible)q.push(L,X0,u0,x,E0.z,A0)}}else if(B0.visible)q.push(L,X0,B0,x,E0.z,null)}}}let K0=L.children;for(let X0=0,B0=K0.length;X0<B0;X0++)O5(K0[X0],y,x,l)}function XJ(L,y,x,l){let{opaque:j,transmissive:K0,transparent:X0}=L;if(Y.setupLightsView(x),c===!0)O0.setGlobalState(D.clippingPlanes,x);if(l)q0.viewport(O.copy(l));if(j.length>0)f6(j,y,x);if(K0.length>0)f6(K0,y,x);if(X0.length>0)f6(X0,y,x);q0.buffers.depth.setTest(!0),q0.buffers.depth.setMask(!0),q0.buffers.color.setMask(!0),q0.setPolygonOffset(!1)}function GJ(L,y,x,l){if((x.isScene===!0?x.overrideMaterial:null)!==null)return;if(Y.state.transmissionRenderTarget[l.id]===void 0)Y.state.transmissionRenderTarget[l.id]=new M5(1,1,{generateMipmaps:!0,type:F0.has("EXT_color_buffer_half_float")||F0.has("EXT_color_buffer_float")?R6:N5,minFilter:T8,samples:4,stencilBuffer:H,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:r0.workingColorSpace});let K0=Y.state.transmissionRenderTarget[l.id],X0=l.viewport||O;K0.setSize(X0.z*D.transmissionResolutionScale,X0.w*D.transmissionResolutionScale);let B0=D.getRenderTarget(),L0=D.getActiveCubeFace(),y0=D.getActiveMipmapLevel();if(D.setRenderTarget(K0),D.getClearColor(p),u=D.getClearAlpha(),u<1)D.setClearColor(16777215,0.5);if(D.clear(),h0)P0.render(x);let j0=D.toneMapping;D.toneMapping=I5;let A0=l.viewport;if(l.viewport!==void 0)l.viewport=void 0;if(Y.setupLightsView(l),c===!0)O0.setGlobalState(D.clippingPlanes,l);if(f6(L,x,l),z0.updateMultisampleRenderTarget(K0),z0.updateRenderTargetMipmap(K0),F0.has("WEBGL_multisampled_render_to_texture")===!1){let u0=!1;for(let Q1=0,R1=y.length;Q1<R1;Q1++){let w1=y[Q1],k1=w1.object,f0=w1.geometry,E1=w1.material,t0=w1.group;if(E1.side===n1&&k1.layers.test(l.layers)){let x1=E1.side;E1.side=c1,E1.needsUpdate=!0,DJ(k1,x,l,f0,E1,t0),E1.side=x1,E1.needsUpdate=!0,u0=!0}}if(u0===!0)z0.updateMultisampleRenderTarget(K0),z0.updateRenderTargetMipmap(K0)}if(D.setRenderTarget(B0,L0,y0),D.setClearColor(p,u),A0!==void 0)l.viewport=A0;D.toneMapping=j0}function f6(L,y,x){let l=y.isScene===!0?y.overrideMaterial:null;for(let j=0,K0=L.length;j<K0;j++){let X0=L[j],B0=X0.object,L0=X0.geometry,y0=X0.group,j0=X0.material;if(j0.allowOverride===!0&&l!==null)j0=l;if(B0.layers.test(x.layers))DJ(B0,y,x,L0,j0,y0)}}function DJ(L,y,x,l,j,K0){if(L.onBeforeRender(D,y,x,l,j,K0),L.modelViewMatrix.multiplyMatrices(x.matrixWorldInverse,L.matrixWorld),L.normalMatrix.getNormalMatrix(L.modelViewMatrix),j.onBeforeRender(D,y,x,l,L,K0),j.transparent===!0&&j.side===n1&&j.forceSinglePass===!1)j.side=c1,j.needsUpdate=!0,D.renderBufferDirect(x,y,l,j,L,K0),j.side=Y5,j.needsUpdate=!0,D.renderBufferDirect(x,y,l,j,L,K0),j.side=n1;else D.renderBufferDirect(x,y,l,j,L,K0);L.onAfterRender(D,y,x,l,j,K0)}function y6(L,y,x){if(y.isScene!==!0)y=T0;let l=N0.get(L),j=Y.state.lights,K0=Y.state.shadowsArray,X0=j.state.version,B0=v.getParameters(L,j.state,K0,y,x),L0=v.getProgramCacheKey(B0),y0=l.programs;if(l.environment=L.isMeshStandardMaterial?y.environment:null,l.fog=y.fog,l.envMap=(L.isMeshStandardMaterial?o0:a0).get(L.envMap||l.environment),l.envMapRotation=l.environment!==null&&L.envMap===null?y.environmentRotation:L.envMapRotation,y0===void 0)L.addEventListener("dispose",M0),y0=new Map,l.programs=y0;let j0=y0.get(L0);if(j0!==void 0){if(l.currentProgram===j0&&l.lightsStateVersion===X0)return OJ(L,B0),j0}else B0.uniforms=v.getUniforms(L),L.onBeforeCompile(B0,D),j0=v.acquireProgram(B0,L0),y0.set(L0,j0),l.uniforms=B0.uniforms;let A0=l.uniforms;if(!L.isShaderMaterial&&!L.isRawShaderMaterial||L.clipping===!0)A0.clippingPlanes=O0.uniform;if(OJ(L,B0),l.needsLights=OH(L),l.lightsStateVersion=X0,l.needsLights)A0.ambientLightColor.value=j.state.ambient,A0.lightProbe.value=j.state.probe,A0.directionalLights.value=j.state.directional,A0.directionalLightShadows.value=j.state.directionalShadow,A0.spotLights.value=j.state.spot,A0.spotLightShadows.value=j.state.spotShadow,A0.rectAreaLights.value=j.state.rectArea,A0.ltc_1.value=j.state.rectAreaLTC1,A0.ltc_2.value=j.state.rectAreaLTC2,A0.pointLights.value=j.state.point,A0.pointLightShadows.value=j.state.pointShadow,A0.hemisphereLights.value=j.state.hemi,A0.directionalShadowMap.value=j.state.directionalShadowMap,A0.directionalShadowMatrix.value=j.state.directionalShadowMatrix,A0.spotShadowMap.value=j.state.spotShadowMap,A0.spotLightMatrix.value=j.state.spotLightMatrix,A0.spotLightMap.value=j.state.spotLightMap,A0.pointShadowMap.value=j.state.pointShadowMap,A0.pointShadowMatrix.value=j.state.pointShadowMatrix;return l.currentProgram=j0,l.uniformsList=null,j0}function qJ(L){if(L.uniformsList===null){let y=L.currentProgram.getUniforms();L.uniformsList=L6.seqWithValue(y.seq,L.uniforms)}return L.uniformsList}function OJ(L,y){let x=N0.get(L);x.outputColorSpace=y.outputColorSpace,x.batching=y.batching,x.batchingColor=y.batchingColor,x.instancing=y.instancing,x.instancingColor=y.instancingColor,x.instancingMorph=y.instancingMorph,x.skinning=y.skinning,x.morphTargets=y.morphTargets,x.morphNormals=y.morphNormals,x.morphColors=y.morphColors,x.morphTargetsCount=y.morphTargetsCount,x.numClippingPlanes=y.numClippingPlanes,x.numIntersection=y.numClipIntersection,x.vertexAlphas=y.vertexAlphas,x.vertexTangents=y.vertexTangents,x.toneMapping=y.toneMapping}function DH(L,y,x,l,j){if(y.isScene!==!0)y=T0;z0.resetTextureUnits();let K0=y.fog,X0=l.isMeshStandardMaterial?y.environment:null,B0=S===null?D.outputColorSpace:S.isXRRenderTarget===!0?S.texture.colorSpace:Y6,L0=(l.isMeshStandardMaterial?o0:a0).get(l.envMap||X0),y0=l.vertexColors===!0&&!!x.attributes.color&&x.attributes.color.itemSize===4,j0=!!x.attributes.tangent&&(!!l.normalMap||l.anisotropy>0),A0=!!x.morphAttributes.position,u0=!!x.morphAttributes.normal,Q1=!!x.morphAttributes.color,R1=I5;if(l.toneMapped){if(S===null||S.isXRRenderTarget===!0)R1=D.toneMapping}let w1=x.morphAttributes.position||x.morphAttributes.normal||x.morphAttributes.color,k1=w1!==void 0?w1.length:0,f0=N0.get(l),E1=Y.state.lights;if(c===!0){if(R0===!0||L!==z){let S1=L===z&&l.id===b;O0.setState(l,L,S1)}}let t0=!1;if(l.version===f0.__version){if(f0.needsLights&&f0.lightsStateVersion!==E1.state.version)t0=!0;else if(f0.outputColorSpace!==B0)t0=!0;else if(j.isBatchedMesh&&f0.batching===!1)t0=!0;else if(!j.isBatchedMesh&&f0.batching===!0)t0=!0;else if(j.isBatchedMesh&&f0.batchingColor===!0&&j.colorTexture===null)t0=!0;else if(j.isBatchedMesh&&f0.batchingColor===!1&&j.colorTexture!==null)t0=!0;else if(j.isInstancedMesh&&f0.instancing===!1)t0=!0;else if(!j.isInstancedMesh&&f0.instancing===!0)t0=!0;else if(j.isSkinnedMesh&&f0.skinning===!1)t0=!0;else if(!j.isSkinnedMesh&&f0.skinning===!0)t0=!0;else if(j.isInstancedMesh&&f0.instancingColor===!0&&j.instanceColor===null)t0=!0;else if(j.isInstancedMesh&&f0.instancingColor===!1&&j.instanceColor!==null)t0=!0;else if(j.isInstancedMesh&&f0.instancingMorph===!0&&j.morphTexture===null)t0=!0;else if(j.isInstancedMesh&&f0.instancingMorph===!1&&j.morphTexture!==null)t0=!0;else if(f0.envMap!==L0)t0=!0;else if(l.fog===!0&&f0.fog!==K0)t0=!0;else if(f0.numClippingPlanes!==void 0&&(f0.numClippingPlanes!==O0.numPlanes||f0.numIntersection!==O0.numIntersection))t0=!0;else if(f0.vertexAlphas!==y0)t0=!0;else if(f0.vertexTangents!==j0)t0=!0;else if(f0.morphTargets!==A0)t0=!0;else if(f0.morphNormals!==u0)t0=!0;else if(f0.morphColors!==Q1)t0=!0;else if(f0.toneMapping!==R1)t0=!0;else if(f0.morphTargetsCount!==k1)t0=!0}else t0=!0,f0.__version=l.version;let x1=f0.currentProgram;if(t0===!0)x1=y6(l,y,j);let Y8=!1,g1=!1,t8=!1,Z1=x1.getUniforms(),r1=f0.uniforms;if(q0.useProgram(x1.program))Y8=!0,g1=!0,t8=!0;if(l.id!==b)b=l.id,g1=!0;if(Y8||z!==L){if(q0.buffers.depth.getReversed()&&L.reversedDepth!==!0)L._reversedDepth=!0,L.updateProjectionMatrix();Z1.setValue(T,"projectionMatrix",L.projectionMatrix),Z1.setValue(T,"viewMatrix",L.matrixWorldInverse);let f1=Z1.map.cameraPosition;if(f1!==void 0)f1.setValue(T,H0.setFromMatrixPosition(L.matrixWorld));if(x0.logarithmicDepthBuffer)Z1.setValue(T,"logDepthBufFC",2/(Math.log(L.far+1)/Math.LN2));if(l.isMeshPhongMaterial||l.isMeshToonMaterial||l.isMeshLambertMaterial||l.isMeshBasicMaterial||l.isMeshStandardMaterial||l.isShaderMaterial)Z1.setValue(T,"isOrthographic",L.isOrthographicCamera===!0);if(z!==L)z=L,g1=!0,t8=!0}if(j.isSkinnedMesh){Z1.setOptional(T,j,"bindMatrix"),Z1.setOptional(T,j,"bindMatrixInverse");let S1=j.skeleton;if(S1){if(S1.boneTexture===null)S1.computeBoneTexture();Z1.setValue(T,"boneTexture",S1.boneTexture,z0)}}if(j.isBatchedMesh){if(Z1.setOptional(T,j,"batchingTexture"),Z1.setValue(T,"batchingTexture",j._matricesTexture,z0),Z1.setOptional(T,j,"batchingIdTexture"),Z1.setValue(T,"batchingIdTexture",j._indirectTexture,z0),Z1.setOptional(T,j,"batchingColorTexture"),j._colorsTexture!==null)Z1.setValue(T,"batchingColorTexture",j._colorsTexture,z0)}let a1=x.morphAttributes;if(a1.position!==void 0||a1.normal!==void 0||a1.color!==void 0)S0.update(j,x,x1);if(g1||f0.receiveShadow!==j.receiveShadow)f0.receiveShadow=j.receiveShadow,Z1.setValue(T,"receiveShadow",j.receiveShadow);if(l.isMeshGouraudMaterial&&l.envMap!==null)r1.envMap.value=L0,r1.flipEnvMap.value=L0.isCubeTexture&&L0.isRenderTargetTexture===!1?-1:1;if(l.isMeshStandardMaterial&&l.envMap===null&&y.environment!==null)r1.envMapIntensity.value=y.environmentIntensity;if(g1){if(Z1.setValue(T,"toneMappingExposure",D.toneMappingExposure),f0.needsLights)qH(r1,t8);if(K0&&l.fog===!0)i.refreshFogUniforms(r1,K0);i.refreshMaterialUniforms(r1,l,e,m,Y.state.transmissionRenderTarget[L.id]),L6.upload(T,qJ(f0),r1,z0)}if(l.isShaderMaterial&&l.uniformsNeedUpdate===!0)L6.upload(T,qJ(f0),r1,z0),l.uniformsNeedUpdate=!1;if(l.isSpriteMaterial)Z1.setValue(T,"center",j.center);if(Z1.setValue(T,"modelViewMatrix",j.modelViewMatrix),Z1.setValue(T,"normalMatrix",j.normalMatrix),Z1.setValue(T,"modelMatrix",j.matrixWorld),l.isShaderMaterial||l.isRawShaderMaterial){let S1=l.uniformsGroups;for(let f1=0,e$=S1.length;f1<e$;f1++){let c5=S1[f1];_.update(c5,x1),_.bind(c5,x1)}}return x1}function qH(L,y){L.ambientLightColor.needsUpdate=y,L.lightProbe.needsUpdate=y,L.directionalLights.needsUpdate=y,L.directionalLightShadows.needsUpdate=y,L.pointLights.needsUpdate=y,L.pointLightShadows.needsUpdate=y,L.spotLights.needsUpdate=y,L.spotLightShadows.needsUpdate=y,L.rectAreaLights.needsUpdate=y,L.hemisphereLights.needsUpdate=y}function OH(L){return L.isMeshLambertMaterial||L.isMeshToonMaterial||L.isMeshPhongMaterial||L.isMeshStandardMaterial||L.isShadowMaterial||L.isShaderMaterial&&L.lights===!0}this.getActiveCubeFace=function(){return h},this.getActiveMipmapLevel=function(){return B},this.getRenderTarget=function(){return S},this.setRenderTargetTextures=function(L,y,x){let l=N0.get(L);if(l.__autoAllocateDepthBuffer=L.resolveDepthBuffer===!1,l.__autoAllocateDepthBuffer===!1)l.__useRenderToTexture=!1;N0.get(L.texture).__webglTexture=y,N0.get(L.depthTexture).__webglTexture=l.__autoAllocateDepthBuffer?void 0:x,l.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(L,y){let x=N0.get(L);x.__webglFramebuffer=y,x.__useDefaultFramebuffer=y===void 0};let FH=T.createFramebuffer();this.setRenderTarget=function(L,y=0,x=0){S=L,h=y,B=x;let l=!0,j=null,K0=!1,X0=!1;if(L){let L0=N0.get(L);if(L0.__useDefaultFramebuffer!==void 0)q0.bindFramebuffer(T.FRAMEBUFFER,null),l=!1;else if(L0.__webglFramebuffer===void 0)z0.setupRenderTarget(L);else if(L0.__hasExternalTextures)z0.rebindTextures(L,N0.get(L.texture).__webglTexture,N0.get(L.depthTexture).__webglTexture);else if(L.depthBuffer){let A0=L.depthTexture;if(L0.__boundDepthTexture!==A0){if(A0!==null&&N0.has(A0)&&(L.width!==A0.image.width||L.height!==A0.image.height))throw Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");z0.setupDepthRenderbuffer(L)}}let y0=L.texture;if(y0.isData3DTexture||y0.isDataArrayTexture||y0.isCompressedArrayTexture)X0=!0;let j0=N0.get(L).__webglFramebuffer;if(L.isWebGLCubeRenderTarget){if(Array.isArray(j0[y]))j=j0[y][x];else j=j0[y];K0=!0}else if(L.samples>0&&z0.useMultisampledRTT(L)===!1)j=N0.get(L).__webglMultisampledFramebuffer;else if(Array.isArray(j0))j=j0[x];else j=j0;O.copy(L.viewport),f.copy(L.scissor),g=L.scissorTest}else O.copy(w0).multiplyScalar(e).floor(),f.copy(D0).multiplyScalar(e).floor(),g=v0;if(x!==0)j=FH;if(q0.bindFramebuffer(T.FRAMEBUFFER,j)&&l)q0.drawBuffers(L,j);if(q0.viewport(O),q0.scissor(f),q0.setScissorTest(g),K0){let L0=N0.get(L.texture);T.framebufferTexture2D(T.FRAMEBUFFER,T.COLOR_ATTACHMENT0,T.TEXTURE_CUBE_MAP_POSITIVE_X+y,L0.__webglTexture,x)}else if(X0){let L0=y;for(let y0=0;y0<L.textures.length;y0++){let j0=N0.get(L.textures[y0]);T.framebufferTextureLayer(T.FRAMEBUFFER,T.COLOR_ATTACHMENT0+y0,j0.__webglTexture,x,L0)}}else if(L!==null&&x!==0){let L0=N0.get(L.texture);T.framebufferTexture2D(T.FRAMEBUFFER,T.COLOR_ATTACHMENT0,T.TEXTURE_2D,L0.__webglTexture,x)}b=-1},this.readRenderTargetPixels=function(L,y,x,l,j,K0,X0,B0=0){if(!(L&&L.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let L0=N0.get(L).__webglFramebuffer;if(L.isWebGLCubeRenderTarget&&X0!==void 0)L0=L0[X0];if(L0){q0.bindFramebuffer(T.FRAMEBUFFER,L0);try{let y0=L.textures[B0],j0=y0.format,A0=y0.type;if(!x0.textureFormatReadable(j0)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!x0.textureTypeReadable(A0)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}if(y>=0&&y<=L.width-l&&(x>=0&&x<=L.height-j)){if(L.textures.length>1)T.readBuffer(T.COLOR_ATTACHMENT0+B0);T.readPixels(y,x,l,j,C0.convert(j0),C0.convert(A0),K0)}}finally{let y0=S!==null?N0.get(S).__webglFramebuffer:null;q0.bindFramebuffer(T.FRAMEBUFFER,y0)}}},this.readRenderTargetPixelsAsync=async function(L,y,x,l,j,K0,X0,B0=0){if(!(L&&L.isWebGLRenderTarget))throw Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let L0=N0.get(L).__webglFramebuffer;if(L.isWebGLCubeRenderTarget&&X0!==void 0)L0=L0[X0];if(L0)if(y>=0&&y<=L.width-l&&(x>=0&&x<=L.height-j)){q0.bindFramebuffer(T.FRAMEBUFFER,L0);let y0=L.textures[B0],j0=y0.format,A0=y0.type;if(!x0.textureFormatReadable(j0))throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!x0.textureTypeReadable(A0))throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");let u0=T.createBuffer();if(T.bindBuffer(T.PIXEL_PACK_BUFFER,u0),T.bufferData(T.PIXEL_PACK_BUFFER,K0.byteLength,T.STREAM_READ),L.textures.length>1)T.readBuffer(T.COLOR_ATTACHMENT0+B0);T.readPixels(y,x,l,j,C0.convert(j0),C0.convert(A0),0);let Q1=S!==null?N0.get(S).__webglFramebuffer:null;q0.bindFramebuffer(T.FRAMEBUFFER,Q1);let R1=T.fenceSync(T.SYNC_GPU_COMMANDS_COMPLETE,0);return T.flush(),await cM(T,R1,4),T.bindBuffer(T.PIXEL_PACK_BUFFER,u0),T.getBufferSubData(T.PIXEL_PACK_BUFFER,0,K0),T.deleteBuffer(u0),T.deleteSync(R1),K0}else throw Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(L,y=null,x=0){let l=Math.pow(2,-x),j=Math.floor(L.image.width*l),K0=Math.floor(L.image.height*l),X0=y!==null?y.x:0,B0=y!==null?y.y:0;z0.setTexture2D(L,0),T.copyTexSubImage2D(T.TEXTURE_2D,x,0,0,X0,B0,j,K0),q0.unbindTexture()};let LH=T.createFramebuffer(),PH=T.createFramebuffer();if(this.copyTextureToTexture=function(L,y,x=null,l=null,j=0,K0=null){if(K0===null)if(j!==0)r5("WebGLRenderer: copyTextureToTexture function signature has changed to support src and dst mipmap levels."),K0=j,j=0;else K0=0;let X0,B0,L0,y0,j0,A0,u0,Q1,R1,w1=L.isCompressedTexture?L.mipmaps[K0]:L.image;if(x!==null)X0=x.max.x-x.min.x,B0=x.max.y-x.min.y,L0=x.isBox3?x.max.z-x.min.z:1,y0=x.min.x,j0=x.min.y,A0=x.isBox3?x.min.z:0;else{let a1=Math.pow(2,-j);if(X0=Math.floor(w1.width*a1),B0=Math.floor(w1.height*a1),L.isDataArrayTexture)L0=w1.depth;else if(L.isData3DTexture)L0=Math.floor(w1.depth*a1);else L0=1;y0=0,j0=0,A0=0}if(l!==null)u0=l.x,Q1=l.y,R1=l.z;else u0=0,Q1=0,R1=0;let k1=C0.convert(y.format),f0=C0.convert(y.type),E1;if(y.isData3DTexture)z0.setTexture3D(y,0),E1=T.TEXTURE_3D;else if(y.isDataArrayTexture||y.isCompressedArrayTexture)z0.setTexture2DArray(y,0),E1=T.TEXTURE_2D_ARRAY;else z0.setTexture2D(y,0),E1=T.TEXTURE_2D;T.pixelStorei(T.UNPACK_FLIP_Y_WEBGL,y.flipY),T.pixelStorei(T.UNPACK_PREMULTIPLY_ALPHA_WEBGL,y.premultiplyAlpha),T.pixelStorei(T.UNPACK_ALIGNMENT,y.unpackAlignment);let t0=T.getParameter(T.UNPACK_ROW_LENGTH),x1=T.getParameter(T.UNPACK_IMAGE_HEIGHT),Y8=T.getParameter(T.UNPACK_SKIP_PIXELS),g1=T.getParameter(T.UNPACK_SKIP_ROWS),t8=T.getParameter(T.UNPACK_SKIP_IMAGES);T.pixelStorei(T.UNPACK_ROW_LENGTH,w1.width),T.pixelStorei(T.UNPACK_IMAGE_HEIGHT,w1.height),T.pixelStorei(T.UNPACK_SKIP_PIXELS,y0),T.pixelStorei(T.UNPACK_SKIP_ROWS,j0),T.pixelStorei(T.UNPACK_SKIP_IMAGES,A0);let Z1=L.isDataArrayTexture||L.isData3DTexture,r1=y.isDataArrayTexture||y.isData3DTexture;if(L.isDepthTexture){let a1=N0.get(L),S1=N0.get(y),f1=N0.get(a1.__renderTarget),e$=N0.get(S1.__renderTarget);q0.bindFramebuffer(T.READ_FRAMEBUFFER,f1.__webglFramebuffer),q0.bindFramebuffer(T.DRAW_FRAMEBUFFER,e$.__webglFramebuffer);for(let c5=0;c5<L0;c5++){if(Z1)T.framebufferTextureLayer(T.READ_FRAMEBUFFER,T.COLOR_ATTACHMENT0,N0.get(L).__webglTexture,j,A0+c5),T.framebufferTextureLayer(T.DRAW_FRAMEBUFFER,T.COLOR_ATTACHMENT0,N0.get(y).__webglTexture,K0,R1+c5);T.blitFramebuffer(y0,j0,X0,B0,u0,Q1,X0,B0,T.DEPTH_BUFFER_BIT,T.NEAREST)}q0.bindFramebuffer(T.READ_FRAMEBUFFER,null),q0.bindFramebuffer(T.DRAW_FRAMEBUFFER,null)}else if(j!==0||L.isRenderTargetTexture||N0.has(L)){let a1=N0.get(L),S1=N0.get(y);q0.bindFramebuffer(T.READ_FRAMEBUFFER,LH),q0.bindFramebuffer(T.DRAW_FRAMEBUFFER,PH);for(let f1=0;f1<L0;f1++){if(Z1)T.framebufferTextureLayer(T.READ_FRAMEBUFFER,T.COLOR_ATTACHMENT0,a1.__webglTexture,j,A0+f1);else T.framebufferTexture2D(T.READ_FRAMEBUFFER,T.COLOR_ATTACHMENT0,T.TEXTURE_2D,a1.__webglTexture,j);if(r1)T.framebufferTextureLayer(T.DRAW_FRAMEBUFFER,T.COLOR_ATTACHMENT0,S1.__webglTexture,K0,R1+f1);else T.framebufferTexture2D(T.DRAW_FRAMEBUFFER,T.COLOR_ATTACHMENT0,T.TEXTURE_2D,S1.__webglTexture,K0);if(j!==0)T.blitFramebuffer(y0,j0,X0,B0,u0,Q1,X0,B0,T.COLOR_BUFFER_BIT,T.NEAREST);else if(r1)T.copyTexSubImage3D(E1,K0,u0,Q1,R1+f1,y0,j0,X0,B0);else T.copyTexSubImage2D(E1,K0,u0,Q1,y0,j0,X0,B0)}q0.bindFramebuffer(T.READ_FRAMEBUFFER,null),q0.bindFramebuffer(T.DRAW_FRAMEBUFFER,null)}else if(r1)if(L.isDataTexture||L.isData3DTexture)T.texSubImage3D(E1,K0,u0,Q1,R1,X0,B0,L0,k1,f0,w1.data);else if(y.isCompressedArrayTexture)T.compressedTexSubImage3D(E1,K0,u0,Q1,R1,X0,B0,L0,k1,w1.data);else T.texSubImage3D(E1,K0,u0,Q1,R1,X0,B0,L0,k1,f0,w1);else if(L.isDataTexture)T.texSubImage2D(T.TEXTURE_2D,K0,u0,Q1,X0,B0,k1,f0,w1.data);else if(L.isCompressedTexture)T.compressedTexSubImage2D(T.TEXTURE_2D,K0,u0,Q1,w1.width,w1.height,k1,w1.data);else T.texSubImage2D(T.TEXTURE_2D,K0,u0,Q1,X0,B0,k1,f0,w1);if(T.pixelStorei(T.UNPACK_ROW_LENGTH,t0),T.pixelStorei(T.UNPACK_IMAGE_HEIGHT,x1),T.pixelStorei(T.UNPACK_SKIP_PIXELS,Y8),T.pixelStorei(T.UNPACK_SKIP_ROWS,g1),T.pixelStorei(T.UNPACK_SKIP_IMAGES,t8),K0===0&&y.generateMipmaps)T.generateMipmap(E1);q0.unbindTexture()},this.copyTextureToTexture3D=function(L,y,x=null,l=null,j=0){return r5('WebGLRenderer: copyTextureToTexture3D function has been deprecated. Use "copyTextureToTexture" instead.'),this.copyTextureToTexture(L,y,x,l,j)},this.initRenderTarget=function(L){if(N0.get(L).__webglFramebuffer===void 0)z0.setupRenderTarget(L)},this.initTexture=function(L){if(L.isCubeTexture)z0.setTextureCube(L,0);else if(L.isData3DTexture)z0.setTexture3D(L,0);else if(L.isDataArrayTexture||L.isCompressedArrayTexture)z0.setTexture2DArray(L,0);else z0.setTexture2D(L,0);q0.unbindTexture()},this.resetState=function(){h=0,B=0,S=null,q0.reset(),I0.reset()},typeof __THREE_DEVTOOLS__<"u")__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Z7}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace($){this._outputColorSpace=$;let J=this.getContext();J.drawingBufferColorSpace=r0._getDrawingBufferColorSpace($),J.unpackColorSpace=r0._getUnpackColorSpace()}}var v$={headsTall:7.5,height:1.7,shoulder:1,hip:1,limb:1,sex:0.5},Z8={headsTall:[6.5,9],height:[1.2,2.1],shoulder:[0.7,1.4],hip:[0.7,1.4],limb:[0.8,1.25],sex:[0,1]};function z6($){let J={...v$};if(!$)return J;for(let M of Object.keys(Z8)){let Q=$[M];if(typeof Q==="number"&&Number.isFinite(Q))J[M]=Math.min(Z8[M][1],Math.max(Z8[M][0],Q))}return J}var D5=["thumb","index","middle","ring","pinky"],P1=[],i1=[],c7=[],a={},n7=[];function B1($,J,M){a[$]=P1.length,P1.push($),i1.push(J===null?-1:a[J]),c7.push(M)}B1("pelvis",null,0);B1("spine1","pelvis",0);B1("spine2","spine1",0);B1("spine3","spine2",0);B1("neck","spine3",0);B1("head","neck",0);for(let[$,J]of[["L",1],["R",2]]){B1(`clav${$}`,"spine3",J),B1(`shoulder${$}`,`clav${$}`,J),B1(`elbow${$}`,`shoulder${$}`,J),B1(`wrist${$}`,`elbow${$}`,J);for(let M of D5)B1(`${M}1${$}`,`wrist${$}`,J),B1(`${M}2${$}`,`${M}1${$}`,J),B1(`${M}3${$}`,`${M}2${$}`,J);B1(`hip${$}`,"pelvis",J),B1(`knee${$}`,`hip${$}`,J),B1(`ankle${$}`,`knee${$}`,J),B1(`toe${$}`,`ankle${$}`,J)}var X1=P1.length;for(let $=0;$<X1;$++){let J=P1[$];n7.push(c7[$]===0?$:a[J.slice(0,-1)+(c7[$]===1?"R":"L")])}var l8=($)=>/^(thumb|index|middle|ring|pinky)\d/.test(P1[$]),b1=Math.PI/180,C5=new A(0,1,0),P6=new A(0,0,1),y$=new A(1,0,0),hQ={thumb:{x:0.1,z:0.1,fan:42,len:[0.2,0.16,0.13],r:0.05},index:{x:0.46,z:0.13,fan:4,len:[0.17,0.1,0.082],r:0.04},middle:{x:0.47,z:0.04,fan:0,len:[0.19,0.115,0.088],r:0.042},ring:{x:0.45,z:-0.05,fan:-4,len:[0.175,0.105,0.082],r:0.039},pinky:{x:0.41,z:-0.135,fan:-10,len:[0.14,0.08,0.072],r:0.034}},fQ=Object.fromEntries(Object.entries(hQ).map(([$,J])=>[$,J.r]));function yQ($,J){let M=J.clone().normalize(),Q=$.clone().addScaledVector(M,-$.dot(M)).normalize(),H=new A().crossVectors(Q,M);return{q:new m0().setFromRotationMatrix(new H1().makeBasis(Q,M,H)),x:Q,y:M,z:H}}function g5($,J,M,Q,H,k,K,w,W,E){let R=yQ($,M),Z=R.z.dot(J)<0,U=R.q;return{kind:"ball",F:U,Fi:U.clone().invert(),p1:Q*b1,n1:H*b1,p2:(Z?K:k)*b1,n2:(Z?k:K)*b1,t0:w*b1,t1:W*b1,mirrored:E,zs:Z?-1:1}}function E8($,J,M,Q,H,k,K){let w=yQ($,J);return{kind:"hinge",F:w.q,Fi:w.q.clone().invert(),lo:M*b1,hi:Q*b1,t0:H*b1,t1:k*b1,mirrored:K,axis:w.x}}function TQ($){let J=z6($),M=J.headsTall,Q=J.limb,H=J.height/(3.9899999999999998+(M-3.99)*Q),k=(M-3.99)*H*Q,K=0.34*H,w=0.4*H*J.hip,W=0.82*H*J.shoulder,E=P1.map(()=>new A),R=P1.map(()=>null),Z=(D,P,h,B)=>E[a[D]].set(P,h,B);Z("pelvis",0,K+k+0.2*H,0),Z("spine1",0,0.45*H,0),Z("spine2",0,0.55*H,0),Z("spine3",0,0.55*H,0),Z("neck",0,0.55*H,0),Z("head",0,0.4*H,0.01*H),R[a.head]=new A(0,0.95*H,0);for(let[D,P]of[["L",1],["R",-1]]){Z(`clav${D}`,P*0.12*H,0.5*H,0.06*H),Z(`shoulder${D}`,P*(W-0.12*H),-0.1*H,-0.04*H),Z(`elbow${D}`,P*1.4*H*Q,0,0),Z(`wrist${D}`,P*1.12*H*Q,0,0);for(let h of D5){let B=hQ[h],S=B.fan*b1,b=Math.cos(S),z=Math.sin(S);Z(`${h}1${D}`,P*B.x*H,0,B.z*H),Z(`${h}2${D}`,P*b*B.len[0]*H,0,z*B.len[0]*H),Z(`${h}3${D}`,P*b*B.len[1]*H,0,z*B.len[1]*H),R[a[`${h}3${D}`]]=new A(P*b*B.len[2]*H,0,z*B.len[2]*H)}Z(`hip${D}`,P*w,-0.2*H,0),Z(`knee${D}`,0,-0.53*k,0),Z(`ankle${D}`,0,-0.47*k,0),Z(`toe${D}`,0,-0.22*H,0.55*H),R[a[`toe${D}`]]=new A(0,-0.04*H,0.33*H)}let U=E.map((D,P)=>P===0?0:D.length()),X=E.map(()=>new A);for(let D=0;D<X1;D++)if(X[D].copy(E[D]),i1[D]>=0)X[D].add(X[i1[D]]);let G=P1.map(()=>new A(0,1,0)),q=(D,P)=>{let h=P?E[a[P]]:R[a[D]];if(h&&h.lengthSq()>0)G[a[D]].copy(h).normalize()};q("pelvis","spine1"),q("spine1","spine2"),q("spine2","spine3"),q("spine3","neck"),q("neck","head"),q("head",null);for(let D of["L","R"]){q(`clav${D}`,`shoulder${D}`),q(`shoulder${D}`,`elbow${D}`),q(`elbow${D}`,`wrist${D}`),q(`wrist${D}`,`middle1${D}`);for(let P of D5)q(`${P}1${D}`,`${P}2${D}`),q(`${P}2${D}`,`${P}3${D}`),q(`${P}3${D}`,null);q(`hip${D}`,`knee${D}`),q(`knee${D}`,`ankle${D}`),q(`ankle${D}`,`toe${D}`),q(`toe${D}`,null)}let Y=P1.map(()=>({kind:"free"})),N=new A(0,-1,0),V=(D,P,h,B,S)=>{Y[a[D]]=g5(P6,y$,C5,P,h,B,B,-S,S,!1)};V("spine1",28,15,15,15),V("spine2",25,15,15,15),V("spine3",25,15,15,15),V("neck",35,40,30,45),V("head",25,30,20,40);for(let D of["L","R"]){let P=D==="R",h=(S)=>{let b=G[a[S+D]].clone();return P?b.set(-b.x,b.y,b.z):b},B=(S,b)=>{Y[a[S+D]]=b};B("clav",g5(C5,P6,h("clav"),22,12,20,15,-10,10,P)),B("shoulder",g5(C5,P6,h("shoulder"),115,105,130,50,-85,85,P)),B("elbow",E8(new A(0,-1,0),h("elbow"),0,150,-130,15,P)),B("wrist",g5(C5,P6,h("wrist"),65,75,20,35,-15,15,P));for(let S of D5){let b=h(`${S}1`),z=h(`${S}2`),O=h(`${S}3`),f=(g)=>new A().crossVectors(g,N);if(S==="thumb")B(`${S}1`,g5(C5,new A().crossVectors(C5,b),b,20,50,35,35,-25,25,P)),B(`${S}2`,E8(f(z),z,-5,65,-4,4,P)),B(`${S}3`,E8(f(O),O,-10,85,-3,3,P));else B(`${S}1`,g5(C5,new A().crossVectors(C5,b),b,25,95,15,15,-6,6,P)),B(`${S}2`,E8(f(z),z,0,110,-3,3,P)),B(`${S}3`,E8(f(O),O,0,85,-3,3,P))}B("hip",g5(P6,y$,h("hip"),125,30,55,35,-45,40,P)),B("knee",E8(y$,h("knee"),0,150,-10,10,P)),B("ankle",g5(C5,y$,h("ankle"),25,50,15,15,-22,22,P)),B("toe",E8(new A(-1,0,0),h("toe"),-40,65,0,0,P))}return{props:J,h:H,off:E,len:U,rest:X,dir:G,tip:R,limits:Y,ankleY:K,legLen:k,hipHalf:w,shoulderHalf:W}}var l5=new m0,j$=new m0,G5=new m0;function s7($,J,M,Q,H={t:0,sx:0,sz:0}){if(l5.copy(M),Q)l5.set(M.x,-M.y,-M.z,M.w);l5.premultiply(J).multiply($);let k=Math.hypot(l5.y,l5.w),K=0;if(k>0.000000001)K=2*Math.atan2(l5.y,l5.w);if(K>Math.PI)K-=2*Math.PI;if(K<-Math.PI)K+=2*Math.PI;if(j$.set(0,-Math.sin(K/2),0,Math.cos(K/2)),G5.copy(l5).multiply(j$),G5.w<0)G5.set(-G5.x,-G5.y,-G5.z,-G5.w);let w=Math.min(1,G5.w),W=2*Math.acos(w),E=Math.sin(W/2);if(H.t=K,E<0.000000001)H.sx=0,H.sz=0;else H.sx=G5.x/E*W,H.sz=G5.z/E*W;return H}var v1={t:0,sx:0,sz:0};function o7($,J,M,Q,H,k,K){let w=Math.hypot(M,Q);if(w<0.000000000001)K.set(0,0,0,1);else{let W=Math.sin(w/2)/w;K.set(M*W,0,Q*W,Math.cos(w/2))}if(j$.set(0,Math.sin(H/2),0,Math.cos(H/2)),K.multiply(j$),K.premultiply($).multiply(J),k)K.set(K.x,-K.y,-K.z,K.w);return K.normalize()}function jQ($,J,M){let Q=J>=0?$.p2:$.n2,H=M>=0?$.n1:$.p1;return(J/Q)**2+(M/H)**2}function i7($,J,M){let Q=$.limits[J];if(Q.kind==="free")return 0;s7(Q.F,Q.Fi,M,Q.mirrored,v1);let H=Math.max(0,Q.t0-v1.t,v1.t-Q.t1);if(Q.kind==="hinge")return Math.max(H,Math.abs(v1.sz),Math.max(0,Q.lo-v1.sx,v1.sx-Q.hi));let k=jQ(Q,v1.sx,v1.sz);return Math.max(H,k>1?(Math.sqrt(k)-1)*Math.hypot(v1.sx,v1.sz):0)}function E5($,J,M){let Q=$.limits[J];if(Q.kind==="free")return M.normalize();s7(Q.F,Q.Fi,M,Q.mirrored,v1);let{sx:H,sz:k,t:K}=v1;if(K=Math.min(Q.t1,Math.max(Q.t0,K)),Q.kind==="hinge")H=Math.min(Q.hi,Math.max(Q.lo,H)),k=0;else{let w=jQ(Q,H,k);if(w>1){let W=1/Math.sqrt(w);H*=W,k*=W}}return o7(Q.F,Q.Fi,H,k,K,Q.mirrored,M)}function vQ($,J){let M=$.limits[J],Q=M.axis.clone();return M.mirrored?Q.set(Q.x,-Q.y,-Q.z):Q}function bQ($,J,M){let Q=$.limits[J];if(Q.kind==="free")return 0;return s7(Q.F,Q.Fi,M,Q.mirrored,v1),v1.t}function d5($,J,M,Q,H){let k=$.limits[J];return o7(k.F,k.Fi,M,0,Q,k.mirrored,H)}function V6($,J,M,Q,H,k){let K=$.limits[J];if(K.kind!=="ball")return k.set(0,0,0,1);let w=K.zs;return o7(K.F,K.Fi,w*Q*b1,-M*b1,H*b1,K.mirrored,k)}function b$($,J=$){return J.set($.x,-$.y,-$.z,$.w)}var A1=["footL","footR","handL","handR"];class B6{rig;q;rootP;rootQ=new m0;wp;wq;pins={footL:null,footR:null,handL:null,handR:null};constructor($){this.rig=TQ($),this.q=this.rig.off.map(()=>new m0),this.wp=this.rig.off.map(()=>new A),this.wq=this.rig.off.map(()=>new m0),this.rootP=this.rig.rest[0].clone(),this.fk()}lowestY(){let $=1/0;for(let J of["ankleL","ankleR","toeL","toeR"])$=Math.min($,this.wp[a[J]].y);return $}setProps($){this.fk();let J=this.lowestY();this.rig=TQ({...this.rig.props,...$}),this.fk(),this.rootP.y+=J-this.lowestY();for(let M of A1)this.pins[M]=null;this.fk()}fk($=0){let{off:J}=this.rig;if($===0)this.wq[0].copy(this.rootQ),this.wp[0].copy(this.rootP),$=1;for(let M=$;M<X1;M++){let Q=i1[M];this.wq[M].multiplyQuaternions(this.wq[Q],this.q[M]),this.wp[M].copy(J[M]).applyQuaternion(this.wq[Q]).add(this.wp[Q])}}clone(){let $=new B6(this.rig.props);return $.rig=this.rig,$.copyFrom(this),$}copyFrom($){this.rig=$.rig;for(let J=0;J<X1;J++)this.q[J].copy($.q[J]);this.rootP.copy($.rootP),this.rootQ.copy($.rootQ);for(let J of A1){let M=$.pins[J];this.pins[J]=M?{p:M.p.clone(),q:M.q.clone()}:null}this.fk()}jointWorld($){return this.wp[a[$]]}}var p$=0,pQ=1,x$=2,g$=3,d$=4,Z5=($)=>({i:[$,0,0,0],w:[1,0,0,0]}),xQ=($,J,M)=>({i:[$,J,0,0],w:[1-M,M,0,0]}),l$=($)=>{return $=Math.min(1,Math.max(0,$)),$*$*(3-2*$)};class gQ{pos=[];nrm=[];si=[];sw=[];part=[];idx=[];grid($,J,M,Q,H){let k=this.pos.length/3,K=$.length,w=$[0].length,W=new Float32Array(K*w*3);for(let N=0;N<K;N++)for(let V=0;V<w;V++){let D=$[N][V];this.pos.push(D.x,D.y,D.z);let P=J[N];this.si.push(...P.i),this.sw.push(...P.w),this.part.push(M)}let E=new A,R=new A,Z=new A,U=new A,X=new A,G=new A,q=(N,V,D)=>{this.idx.push(k+N,k+V,k+D),E.fromArray(this.pos,(k+N)*3),R.fromArray(this.pos,(k+V)*3),Z.fromArray(this.pos,(k+D)*3),G.crossVectors(U.subVectors(R,E),X.subVectors(Z,E));for(let P of[N,V,D])W[P*3]+=G.x,W[P*3+1]+=G.y,W[P*3+2]+=G.z};for(let N=0;N<K-1;N++)for(let V=0;V<w;V++){let D=(V+1)%w,P=N*w+V,h=N*w+D,B=(N+1)*w+V,S=(N+1)*w+D;q(P,h,B),q(h,S,B)}let Y=(N,V)=>{if(!V)return;for(let D=0;D<w;D++){let P=(N*w+D)*3;W[P]=V.x,W[P+1]=V.y,W[P+2]=V.z}};Y(0,Q),Y(K-1,H);for(let N=0;N<K*w;N++)G.set(W[N*3],W[N*3+1],W[N*3+2]).normalize(),this.nrm.push(G.x,G.y,G.z)}tube($,J){let M=J.capSteps??6,Q=$[0],H=$[$.length-1],k=new A().subVectors($[1].c,Q.c).normalize(),K=new A().subVectors(H.c,$[$.length-2].c).normalize(),w=[],W=[],E=(U,X,G,q)=>{let Y=J.u.clone().addScaledVector(X,-J.u.dot(X)).normalize(),N=new A().crossVectors(X,Y),V=[];for(let D=0;D<J.seg;D++){let P=D/J.seg*Math.PI*2;V.push(U.clone().addScaledVector(Y,G*Math.cos(P)).addScaledVector(N,q*Math.sin(P)))}return V};if(J.startCap)for(let U=0;U<M;U++){let X=Math.PI/2*(1-U/M),G=Math.cos(X),q=Q.c.clone().addScaledVector(k,-J.startCap*Math.sin(X));w.push(E(q,k,Q.rx*G,Q.rz*G)),W.push(Q.skin)}for(let U of $)w.push(E(U.c,U===Q?k:U===H?K:k,U.rx,U.rz)),W.push(U.skin);if(J.endCap)for(let U=1;U<=M;U++){let X=Math.PI/2*(U/M),G=Math.cos(X),q=H.c.clone().addScaledVector(K,J.endCap*Math.sin(X));w.push(E(q,K,H.rx*G,H.rz*G)),W.push(H.skin)}let R=J.startCap?k.clone().negate():null,Z=J.endCap?K.clone():null;this.grid(w,W,J.part,R,Z)}geometry(){let $=new o1;return $.setAttribute("position",new N1(new Float32Array(this.pos),3)),$.setAttribute("normal",new N1(new Float32Array(this.nrm),3)),$.setAttribute("skinIndex",new N1(new Float32Array(this.si),4)),$.setAttribute("skinWeight",new N1(new Float32Array(this.sw),4)),$.setAttribute("part",new N1(new Float32Array(this.part),1)),$.setIndex(this.idx.length>65535?new N1(new Uint32Array(this.idx),1):new N1(new Uint16Array(this.idx),1)),$}}function AE($,J){let M=Math.min($.length-1.0001,Math.max(0,J*($.length-1))),Q=Math.floor(M),H=M-Q;return $[Q].map((k,K)=>k+($[Q+1][K]-k)*H)}function SE($,J){let M=[],Q=$.length;for(let H=0;H<J;H++){let k=H/(J-1)*(Q-1),K=Math.min(Q-2,Math.floor(k)),w=k-K,W=$[Math.max(0,K-1)],E=$[K],R=$[K+1],Z=$[Math.min(Q-1,K+2)];M.push(E.map((U,X)=>0.5*(2*E[X]+(-W[X]+R[X])*w+(2*W[X]-5*E[X]+4*R[X]-Z[X])*w*w+(-W[X]+3*E[X]-3*R[X]+Z[X])*w*w*w)))}return M}function lQ($){let J=new gQ,M=$.h,Q=$.rest[0],H=new A(1,0,0),k=new A(0,0,1),{props:K}=$,w=1+(K.hip-1)*0.8,W=1+(K.shoulder-1)*0.6,E=(K.sex-0.5)*2,R=1-0.09*(-E>0?-E:0)+0.05*(E>0?E:0),Z=-E>0?-E:0,U=SE([[-0.44,0.1,0.1,0],[-0.34,0.5*w,0.4,-0.02],[-0.12,0.66*w,0.47,-0.03],[0.2,0.62*w,0.43,-0.03],[0.5,0.5*R,0.36,0],[0.95,0.55*R,0.39+0.02*Z,0.02],[1.35,0.7*W*(1-0.03*Z),0.42+0.07*Z,0.04+0.03*Z],[1.7,0.75*W*(1+0.04*E),0.4+0.02*Z,0.03+0.01*Z],[1.98,0.64*W,0.32,0],[2.16,0.32,0.24,0],[2.3,0.2,0.2,0]],44),X=[0,0.45,1,1.55,2.1],G=[a.pelvis,a.spine1,a.spine2,a.spine3,a.neck],q=(O)=>{if(O<=X[0])return Z5(G[0]);if(O>=X[4])return Z5(G[4]);let f=0;while(O>X[f+1])f++;return xQ(G[f],G[f+1],l$((O-X[f])/(X[f+1]-X[f])))};J.tube(U.map((O)=>({c:new A(0,Q.y+O[0]*M,O[3]*M),rx:O[1]*M,rz:O[2]*M,skin:q(O[0])})),{u:H,seg:32,part:pQ,capSteps:1});let Y=$.rest[a.neck],N=$.rest[a.head],V=[];for(let O=0;O<=5;O++){let f=O/5;V.push({c:Y.clone().lerp(N,f).add(new A(0,-0.1*M*(1-f),0)),rx:(0.215-0.02*f)*M,rz:(0.215-0.02*f)*M,skin:xQ(a.neck,a.head,l$((f-0.35)/0.65))})}J.tube(V,{u:H,seg:20,part:p$});let D=$.rest[a.head].clone().add(new A(0,0.45*M,0.03*M)),P=Z5(a.head),h=28,B=36,S=[],b=[];for(let O=0;O<=h;O++){let f=-Math.PI/2+O/h*Math.PI,g=Math.sin(f),p=Math.cos(f),u=g<0?1-0.32*l$(-g*1.1):1-0.06*g*g,t=[];for(let m=0;m<B;m++){let e=m/B*Math.PI*2,d=Math.cos(e)*p,Q0=-Math.sin(e)*p,w0=Q0>=0?0.43:0.5,D0=g<0&&Q0>0?0.04*l$(-g)*Q0:0;t.push(new A(D.x+0.37*M*d*u,D.y+0.5*M*g,D.z+M*(w0*Q0*u+D0)))}S.push(t),b.push(P)}J.grid(S,b,p$,new A(0,-1,0),new A(0,1,0));let z=(O,f,g,p,u,t,m=14,e=10)=>{let d=[],Q0=[];for(let w0=0;w0<=e;w0++){let D0=-Math.PI/2+w0/e*Math.PI,v0=[];for(let l0=0;l0<m;l0++){let c=l0/m*Math.PI*2;v0.push(new A(O.x+f*Math.cos(D0)*Math.cos(c),O.y+g*Math.sin(D0),O.z-p*Math.cos(D0)*Math.sin(c)))}d.push(v0),Q0.push(t)}J.grid(d,Q0,u,new A(0,-1,0),new A(0,1,0))};z(D.clone().add(new A(0,-0.06*M,0.4*M)),0.065*M,0.1*M,0.1*M,p$,P,12,8);for(let O of[1,-1])z(D.clone().add(new A(O*0.37*M,-0.02*M,-0.02*M)),0.04*M,0.1*M,0.07*M,p$,P,12,8);for(let[O,f]of[["L",1],["R",-1]]){let g=$.rest[a[`clav${O}`]],p=$.rest[a[`shoulder${O}`]];J.tube([{c:g,rx:0.15*M,rz:0.15*M,skin:Z5(a[`clav${O}`])},{c:g.clone().lerp(p,0.5),rx:0.16*M,rz:0.16*M,skin:Z5(a[`clav${O}`])},{c:p,rx:0.17*M,rz:0.17*M,skin:Z5(a[`clav${O}`])}],{u:k,seg:16,part:pQ,startCap:0.15*M,endCap:0.17*M});let u=(H0,E0,T0,h0,_0,T,d0=20,F0=7,x0=1)=>{let q0=$.rest[a[H0+O]],n0=$.rest[a[E0+O]],N0=[];for(let a0=0;a0<F0;a0++){let o0=a0/(F0-1),M1=AE(T0,o0);N0.push({c:q0.clone().lerp(n0,o0),rx:M1[0]*M,rz:(M1[1]??M1[0])*M,skin:Z5(a[H0+O])})}let z0=N0[F0-1];J.tube(N0,{u:T,seg:d0,part:h0,startCap:_0?N0[0].rx:0,endCap:z0.rx*x0})};u("shoulder","elbow",[[0.24],[0.215],[0.19],[0.17],[0.165]],x$,!0,k),u("elbow","wrist",[[0.165],[0.178],[0.16],[0.13],[0.105]],x$,!1,k),u("hip","knee",[[0.34],[0.325],[0.29],[0.245],[0.2]],g$,!0,H,24,8),u("knee","ankle",[[0.2],[0.215],[0.205],[0.15],[0.115]],g$,!1,H,22,8);let t=$.rest[a[`wrist${O}`]],m=new A(f,0,0),e=Z5(a[`wrist${O}`]),d=[],Q0=[[0.12,0.085],[0.17,0.09],[0.205,0.085],[0.215,0.075],[0.21,0.065]];for(let H0=0;H0<Q0.length;H0++){let E0=H0/(Q0.length-1);d.push({c:t.clone().addScaledVector(m,(-0.04+E0*0.52)*M).add(new A(0,0,0*M)),rx:Q0[H0][0]*M,rz:Q0[H0][1]*M,skin:e})}J.tube(d,{u:k,seg:16,part:x$,startCap:0.06*M,endCap:0.06*M});for(let H0 of D5){let E0=fQ[H0]*M*1.12,T0=a[`${H0}1${O}`],h0=a[`${H0}2${O}`],_0=a[`${H0}3${O}`],T=$.rest[T0],d0=$.rest[h0],F0=$.rest[_0],x0=F0.clone().add($.tip[_0]);[[T,d0,T0,E0*(H0==="thumb"?1.12:1),E0*0.96],[d0,F0,h0,E0*0.96,E0*0.9],[F0,x0,_0,E0*0.9,E0*0.72]].forEach(([N0,z0,a0,o0,M1],I)=>{let F=[];for(let v=0;v<3;v++){let i=v/2,$0=o0+(M1-o0)*i;F.push({c:N0.clone().lerp(z0,i),rx:$0,rz:$0*0.92,skin:Z5(a0)})}J.tube(F,{u:new A(0,1,0),seg:10,part:x$,startCap:I===0?o0:0,endCap:M1,capSteps:4})})}let w0=$.rest[a[`ankle${O}`]],D0=$.rest[a[`toe${O}`]],v0=Z5(a[`ankle${O}`]),l0=Z5(a[`toe${O}`]),R0=[[-0.3,0.13,0.12],[-0.2,0.17,0.155],[0,0.2,0.16],[0.2,0.15,0.17],[0.4,0.115,0.2],[0.55,0.098,0.215]].map(([H0,E0,T0])=>({c:new A(w0.x,E0*M,w0.z+H0*M),rx:T0*M,rz:E0*M,skin:v0}));R0[R0.length-1].c.copy(new A(D0.x,0.098*M,D0.z)),J.tube(R0,{u:H,seg:20,part:g$,startCap:0.14*M,endCap:0.1*M});let G0=[[0.55,0.098,0.215],[0.72,0.075,0.195],[0.86,0.058,0.15]].map(([H0,E0,T0])=>({c:new A(D0.x,E0*M,D0.z+(H0-0.55)*M),rx:T0*M,rz:E0*M,skin:l0}));J.tube(G0,{u:H,seg:16,part:g$,endCap:0.06*M})}return J.geometry()}function m$($,J){let{rest:M}=$.rig,Q=new A;for(let H=0;H<X1;H++){let k=J[H];k.makeRotationFromQuaternion($.wq[H]);let K=k.elements;Q.copy(M[H]).applyQuaternion($.wq[H]),K[12]=$.wp[H].x-Q.x,K[13]=$.wp[H].y-Q.y,K[14]=$.wp[H].z-Q.z}}function dQ($,J,M){let Q=$.getAttribute("position").array,H=$.getAttribute("skinIndex").array,k=$.getAttribute("skinWeight").array,K=Q.length/3,w=M&&M.length===Q.length?M:new Float32Array(Q.length);for(let W=0;W<K;W++){let E=Q[W*3],R=Q[W*3+1],Z=Q[W*3+2],U=0,X=0,G=0;for(let q=0;q<4;q++){let Y=k[W*4+q];if(Y===0)continue;let N=J[H[W*4+q]].elements;U+=Y*(N[0]*E+N[4]*R+N[8]*Z+N[12]),X+=Y*(N[1]*E+N[5]*R+N[9]*Z+N[13]),G+=Y*(N[2]*E+N[6]*R+N[10]*Z+N[14])}w[W*3]=U,w[W*3+1]=X,w[W*3+2]=G}return w}var R8=[[255,90,60],[60,205,140],[80,140,255],[255,190,50]],mQ=[[255,0,0],[0,255,0],[0,0,255],[255,255,0]];function TE($){return[[[255,0,0],[0,255,0],[0,0,255],[255,255,0]],[[255,0,255],[0,255,255],[255,128,0],[128,0,255]],[[0,255,128],[255,0,128],[128,255,0],[0,128,255]],[[255,160,160],[160,255,160],[160,160,255],[255,255,160]]][$%4]}var uQ=X1,u$=`
attribute vec4 skinIndex;
attribute vec4 skinWeight;
attribute float part;
uniform mat4 uBones[${uQ}];
varying vec3 vN;
varying vec3 vP;
varying float vPart;
varying float vD;
void main(){
  mat4 s = skinWeight.x*uBones[int(skinIndex.x+.5)] + skinWeight.y*uBones[int(skinIndex.y+.5)] + skinWeight.z*uBones[int(skinIndex.z+.5)] + skinWeight.w*uBones[int(skinIndex.w+.5)];
  vec4 wp = s*vec4(position,1.0);
  vP = wp.xyz;
  vN = mat3(s)*normal;
  vPart = part;
  vec4 mv = viewMatrix*wp;
  vD = -mv.z;
  gl_Position = projectionMatrix*mv;
}`,hE=`
uniform vec3 uColor;
uniform vec3 uKeyDir;
uniform vec3 uFillDir;
uniform sampler2D uShadowMap;
uniform mat4 uShadowMat;
uniform float uShadowOn;
uniform float uTexel;
uniform float uHi;
varying vec3 vN;
varying vec3 vP;
varying float vPart;
varying float vD;
float shadowAt(vec3 N, float ndl){
  vec4 lp = uShadowMat*vec4(vP + N*0.012, 1.0);
  vec3 c = lp.xyz*0.5+0.5;
  if(c.x<0.||c.x>1.||c.y<0.||c.y>1.||c.z>1.) return 1.0;
  float bias = 0.0012 + 0.0025*(1.0-ndl);
  float lit = 0.0;
  for(int x=-1;x<=1;x++){
    for(int y=-1;y<=1;y++){
      float d = texture2D(uShadowMap, c.xy + vec2(float(x),float(y))*uTexel).r;
      lit += (c.z - bias <= d) ? 1.0 : 0.0;
    }
  }
  return lit/9.0;
}
void main(){
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vP);
  float ndl = max(dot(N,uKeyDir),0.0);
  float sh = uShadowOn > 0.5 ? mix(0.18, 1.0, shadowAt(N, ndl)) : 1.0;
  float fd = max(dot(N,uFillDir),0.0);
  vec3 amb = mix(vec3(0.17,0.16,0.2), vec3(0.34,0.35,0.4), N.y*0.5+0.5);
  float tint = vPart < 0.5 ? 1.0 : (vPart < 1.5 ? 0.97 : (vPart < 2.5 ? 1.05 : 0.93));
  vec3 base = uColor*tint;
  vec3 H = normalize(uKeyDir + V);
  float spec = pow(max(dot(N,H),0.0), 42.0)*0.2*ndl*sh;
  float rim = pow(1.0 - max(dot(N,V),0.0), 3.0);
  vec3 col = base*(amb + 0.82*ndl*sh + 0.3*fd*vec3(0.85,0.92,1.0)) + vec3(spec) + uHi*rim*0.35*vec3(0.6,1.0,0.9);
  gl_FragColor = vec4(clamp(col,0.0,1.0),1.0);
}`,fE=`
uniform vec3 uColor;
uniform vec3 uPartColors[${d$}];
uniform float uByPart;
varying float vPart;
void main(){
  vec3 c = uByPart > 0.5 ? uPartColors[int(vPart+0.5)] : uColor;
  gl_FragColor = vec4(c, 1.0);
}`,yE=`
uniform float uNear;
uniform float uFar;
varying float vD;
void main(){
  float v = 1.0 - clamp((vD - uNear)/(uFar - uNear), 0.0, 1.0);
  gl_FragColor = vec4(vec3(v), 1.0);
}`,jE="void main(){ gl_FragColor = vec4(1.0); }",vE=`
attribute vec4 skinIndex;
attribute vec4 skinWeight;
uniform mat4 uBones[${uQ}];
uniform vec3 uShadowLight;
void main(){
  mat4 s = skinWeight.x*uBones[int(skinIndex.x+.5)] + skinWeight.y*uBones[int(skinIndex.y+.5)] + skinWeight.z*uBones[int(skinIndex.z+.5)] + skinWeight.w*uBones[int(skinIndex.w+.5)];
  vec4 wp = s*vec4(position,1.0);
  wp.xyz -= uShadowLight*(wp.y/uShadowLight.y);
  wp.y = 0.002;
  gl_Position = projectionMatrix*viewMatrix*wp;
}`,bE="void main(){ gl_FragColor = vec4(0.0,0.0,0.0,0.34); }",pE=new A(-0.55,0.7,0.62).normalize(),xE=new A(0.75,-0.1,0.5).normalize();class r7{canvas;renderer;scene=new I$;figs=new Map;shared;gridLines;shadowRT=null;exportRT=null;lightCam=new O6(-1,1,1,-1,0.1,10);exportCam=new L1;lost=!1;disposed=!1;shadowSize=1024;constructor($){this.canvas=$;this.renderer=new u7({canvas:$,antialias:!0,alpha:!0,powerPreference:"high-performance"}),this.renderer.setClearColor(0,0),this.shared={uKeyDir:{value:new A(0,1,0)},uFillDir:{value:new A(1,0,0)},uShadowMap:{value:null},uShadowMat:{value:new H1},uShadowOn:{value:1},uTexel:{value:1/this.shadowSize},uNear:{value:1},uFar:{value:10},uShadowLight:{value:new A(-0.35,1,-0.2).normalize()}};let J=[],M=3;for(let H=-M*2;H<=M*2;H++){let k=H*0.5;J.push(-M,0,k,M,0,k,k,0,-M,k,0,M)}let Q=new o1;Q.setAttribute("position",new m1(J,3)),this.gridLines=new _$(Q,new D6({color:3494220,transparent:!0,opacity:0.55})),this.gridLines.position.y=0.001,this.scene.add(this.gridLines)}makeFig($,J,M){let Q=lQ(J.rig),H=Array.from({length:X1},()=>new H1),k={value:H},K={value:new A(1,1,1)},w={value:0},W={value:Array.from({length:d$},()=>new A)},E={value:0},R={uBones:k,uColor:K,uHi:w,uPartColors:W,uByPart:E,...this.shared},Z=(Y,N,V={})=>new Q5({vertexShader:Y,fragmentShader:N,uniforms:R,...V}),U={shaded:Z(u$,hE,{side:Y5}),flat:Z(u$,fE,{side:Y5}),depth:Z(u$,yE,{side:Y5}),shadow:Z(u$,jE,{side:n1}),planar:Z(vE,bE,{transparent:!0,depthFunc:A8,depthWrite:!0,side:n1,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1})},X=new j1(Q,U.shaded);X.frustumCulled=!1,X.matrixAutoUpdate=!1;let G=new j1(Q,U.planar);G.frustumCulled=!1,G.matrixAutoUpdate=!1,G.renderOrder=-1,this.scene.add(X,G);let q={id:$,body:J,geo:Q,mats:H,uBones:k,uColor:K,uHi:w,uPartColors:W,uByPart:E,mesh:X,shadowMesh:G,m:U,propsRef:J.rig,color:M};return this.applyColor(q,M),q}applyColor($,J){$.color=J;let M=R8[J%R8.length];$.uColor.value.set(M[0]/255,M[1]/255,M[2]/255)}disposeFig($){this.scene.remove($.mesh,$.shadowMesh),$.geo.dispose();for(let J of Object.values($.m))J.dispose()}sync($){let J=new Set($.map((M)=>M.id));for(let[M,Q]of this.figs)if(!J.has(M))this.disposeFig(Q),this.figs.delete(M);for(let M of $){let Q=this.figs.get(M.id);if(Q&&(Q.body!==M.body||Q.propsRef!==M.body.rig))this.disposeFig(Q),Q=void 0;if(!Q)Q=this.makeFig(M.id,M.body,M.color),this.figs.set(M.id,Q);if(Q.color!==M.color)this.applyColor(Q,M.color);m$(M.body,Q.mats)}}setSize($,J,M){this.renderer.setPixelRatio(M),this.renderer.setSize($,J,!1)}setLights($){this.shared.uKeyDir.value.copy(pE).applyQuaternion($.quaternion),this.shared.uFillDir.value.copy(xE).applyQuaternion($.quaternion)}bounds(){let $=[];for(let M of this.figs.values()){M.body.fk();for(let Q=0;Q<X1;Q++)$.push(M.body.wp[Q])}let J=new x5().setFromPoints($);return J.radius+=0.35,J}shadowPass(){if(!this.shadowRT){let H=new v8(this.shadowSize,this.shadowSize);H.minFilter=s1,H.magFilter=s1,this.shadowRT=new M5(this.shadowSize,this.shadowSize,{depthTexture:H,minFilter:s1,magFilter:s1})}let $=this.bounds(),J=this.shared.uKeyDir.value,M=this.lightCam;if(M.left=-$.radius,M.right=$.radius,M.top=$.radius,M.bottom=-$.radius,M.near=0.1,M.far=$.radius*4,M.position.copy($.center).addScaledVector(J,$.radius*2),M.up.set(0,1,0),Math.abs(J.y)>0.98)M.up.set(0,0,1);M.lookAt($.center),M.updateProjectionMatrix(),M.updateMatrixWorld(),this.shared.uShadowMat.value.multiplyMatrices(M.projectionMatrix,M.matrixWorldInverse),this.shared.uShadowMap.value=this.shadowRT.depthTexture,this.shared.uTexel.value=1/this.shadowSize,this.gridLines.visible=!1;for(let H of this.figs.values())H.mesh.material=H.m.shadow,H.mesh.visible=!0,H.shadowMesh.visible=!1;let Q=this.renderer;Q.setRenderTarget(this.shadowRT),Q.setClearColor(0,1),Q.clear(!0,!0,!1),Q.render(this.scene,M),Q.setRenderTarget(null)}renderView($,J){if(this.lost||this.disposed)return;let M=this.renderer;if(this.setLights($),this.shared.uShadowOn.value=1,this.shadowPass(),M.setClearColor(0,0),M.clear(),this.gridLines.visible=J.grid,this.shared.uShadowLight.value.copy(this.shared.uKeyDir.value),this.shared.uShadowLight.value.y<0.25)this.shared.uShadowLight.value.y=0.25;this.shared.uShadowLight.value.normalize();for(let Q of this.figs.values())Q.mesh.material=Q.m.shaded,Q.mesh.visible=!0,Q.shadowMesh.visible=J.shadow,Q.uHi.value=J.selected===Q.id?1:0,Q.uByPart.value=0;M.render(this.scene,$)}rt($,J,M){let Q=`${$}x${J}x${M}`;if(this.exportRT&&this.exportRT.key!==Q)this.exportRT.rt.dispose(),this.exportRT=null;if(!this.exportRT){let H=new M5($,J,{samples:M,type:N5,format:J5,minFilter:s1,magFilter:s1,depthBuffer:!0});this.exportRT={key:Q,rt:H}}return this.exportRT.rt}depthRange($){$.updateMatrixWorld();let J=$.matrixWorldInverse,M=1/0,Q=-1/0;for(let H of this.figs.values()){m$(H.body,H.mats);let k=dQ(H.geo,H.mats),K=J.elements;for(let w=0;w<k.length;w+=3){let W=-(K[2]*k[w]+K[6]*k[w+1]+K[10]*k[w+2]+K[14]);if(W<M)M=W;if(W>Q)Q=W}}if(!Number.isFinite(M))M=1,Q=2;return{near:M,far:Q}}renderMap($,J,M,Q,H={}){if(this.lost||this.disposed)throw Error("WebGL context lost");let k=this.renderer,K=this.rt(M,Q,$==="region"?0:4);this.setLights(J),this.gridLines.visible=!1;let w=[...this.figs.values()];for(let Z of w)m$(Z.body,Z.mats);if($==="mesh")this.shared.uShadowOn.value=1,this.shadowPass();if($==="depth"){let{near:Z,far:U}=this.depthRange(J),X=Math.max(0.02,(U-Z)*0.04);this.shared.uNear.value=Z-X,this.shared.uFar.value=U+X}w.forEach((Z,U)=>{if(Z.mesh.visible=!0,Z.shadowMesh.visible=!1,Z.uHi.value=0,Z.mesh.material=$==="mesh"?Z.m.shaded:$==="depth"?Z.m.depth:Z.m.flat,$==="region"){let X=H.regionMode==="parts";Z.uByPart.value=X?1:0;let G=mQ[U%mQ.length];Z.uColor.value.set(G[0]/255,G[1]/255,G[2]/255);let q=TE(U);for(let Y=0;Y<d$;Y++)Z.uPartColors.value[Y].set(q[Y][0]/255,q[Y][1]/255,q[Y][2]/255)}}),k.setRenderTarget(K),k.setClearColor(0,1),k.clear(!0,!0,!0),k.render(this.scene,J);let W=new Uint8Array(M*Q*4);k.readRenderTargetPixels(K,0,0,M,Q,W),k.setRenderTarget(null),k.setClearColor(0,0);for(let Z of w){let U=R8[Z.color%R8.length];Z.uColor.value.set(U[0]/255,U[1]/255,U[2]/255),Z.uByPart.value=0}let E=new Uint8ClampedArray(M*Q*4),R=M*4;for(let Z=0;Z<Q;Z++)E.set(W.subarray((Q-1-Z)*R,(Q-Z)*R),Z*R);return new ImageData(E,M,Q)}dispose(){if(this.disposed)return;this.disposed=!0;for(let $ of this.figs.values())this.disposeFig($);this.figs.clear(),this.gridLines.geometry.dispose(),this.gridLines.material.dispose(),this.shadowRT?.depthTexture?.dispose(),this.shadowRT?.dispose(),this.exportRT?.rt.dispose(),this.shadowRT=null,this.exportRT=null,this.renderer.dispose(),this.renderer.forceContextLoss()}}function c$($,J,M){let Q=M==="L"?1:-1,H=J==="arm";return{name:$,kind:J,clav:H?a[`clav${M}`]:-1,root:a[`${H?"shoulder":"hip"}${M}`],mid:a[`${H?"elbow":"knee"}${M}`],end:a[`${H?"wrist":"ankle"}${M}`],parent:H?a[`clav${M}`]:a.pelvis,pole:H?new A(Q*0.35,-0.45,-0.8):new A(Q*0.1,0.05,1),pin:`${H?"hand":"foot"}${M}`}}var R5={armL:c$("armL","arm","L"),armR:c$("armR","arm","R"),legL:c$("legL","leg","L"),legR:c$("legR","leg","R")},U8={footL:R5.legL,footR:R5.legR,handL:R5.armL,handR:R5.armR},a7=new WeakMap,z1=()=>new A,m8=z1(),n$=z1(),gE=z1(),lE=z1(),dE=z1(),mE=z1(),m5=new m0,d8=new m0,nQ=new m0,uE=new m0,cE=new H1,sQ=new m0;function cQ($,J,M){let Q=mE.crossVectors($,J);return M.setFromRotationMatrix(cE.makeBasis($,J,Q))}function I6($,J,M){return M.copy($).addScaledVector(J,-$.dot(J))}function nE($,J,M=z1()){return M.copy(J).applyQuaternion($.rootQ)}function sE($,J,M){let{rig:Q}=$,H=J.clav;m5.copy($.wq[i1[H]]).invert();let k=m8.subVectors(M,$.wp[H]).normalize().applyQuaternion(m5),K=d8.setFromUnitVectors(Q.dir[H],k);K.copy(sQ).slerp(K,0.22),$.q[H].copy(E5(Q,H,K)),$.fk(H)}function _5($,J,M,Q={}){let{rig:H}=$;if($.fk(),J.kind==="arm"&&Q.assist!==!1)sE($,J,M);let{root:k,mid:K,end:w}=J,W=m8.copy($.wp[k]).clone(),E=H.len[K],R=H.len[w],Z=n$.subVectors(M,W),U=Z.length();if(U<0.000000001)Z.set(0,-1,0),U=0.000000001;let X=Z.clone().divideScalar(U),G=H.limits[K],q=E+R,Y=Math.sqrt(E*E+R*R+2*E*R*Math.cos(G.hi)),N=Math.min(q,Math.max(Y,U)),V=$.wp[K],P=$.wp[w].clone().sub(W).normalize(),h=a7.get($)||{};a7.set($,h);let B=I6(gE.copy(V).sub(W),P,z1());if(B.lengthSq()>0.00000001)B.applyQuaternion(m5.setFromUnitVectors(P,X)).normalize();else if(h[J.name])B.copy(h[J.name]).applyQuaternion(m5.setFromUnitVectors(P,X)).normalize();let S=I6(nE($,Q.pole??J.pole,z1()),X,z1()),b=S.length();if(b>0.000001)S.divideScalar(b);let z=z1();if(Q.elbow)I6(lE.copy(Q.elbow).sub(W),X,z);else{if(B.lengthSq()>0.000000000001)z.copy(B);z.addScaledVector(S,Q.spring??0.12)}if(z.lengthSq()<0.000000000001)if(b>0.000001)z.copy(S);else z.copy(Math.abs(X.y)<0.9?new A(0,1,0):new A(1,0,0));if(I6(z,X,z),z.lengthSq()<0.000000000001)z.set(X.z,X.x,X.y);I6(z,X,z).normalize();let O=new A().crossVectors(X,z),f=nQ.copy($.wq[J.parent]).invert().clone(),g=H.dir[k],p=vQ(H,K),u=cQ(p,g,new m0).invert(),t=bQ(H,K,$.q[K]),m=Math.max(-1,Math.min(1,(E*E+N*N-R*R)/(2*E*N))),e=Math.sqrt(1-m*m),d=X.clone().multiplyScalar(N).add(W),Q0=z1(),w0=z1(),D0=z1(),v0=z1(),l0=new m0,c=new m0,R0=new m0,G0=(_0)=>{if(v0.copy(z).multiplyScalar(Math.cos(_0)).addScaledVector(O,Math.sin(_0)),Q0.copy(X).multiplyScalar(m).addScaledVector(v0,e).normalize(),D0.copy(Q0).multiplyScalar(-E).add(d).sub(W),w0.crossVectors(Q0,D0),w0.length()<0.0000001*R)w0.crossVectors(Q0,dE.copy(v0).negate());w0.normalize(),l0.copy(f).multiply(cQ(w0,Q0,R0).multiply(u));let T=Math.acos(Math.max(-1,Math.min(1,Q0.dot(D0)/Math.max(0.000000000001,D0.length()))));return d5(H,K,T,t,c),i7(H,k,l0)+i7(H,K,c)},H0=Math.PI/45,E0=0,T0=G0(0),h0=T0<=0.00001;if(!h0){let _0=T0,T=0;for(let d0=1;d0<=45&&!h0;d0++)for(let F0 of[1,-1]){let x0=F0*d0*H0,q0=G0(x0);if(q0<_0)_0=q0,T=x0;if(q0<=0.00001){let n0=F0*(d0-1)*H0,N0=x0;for(let z0=0;z0<7;z0++){let a0=(n0+N0)/2;if(G0(a0)<=0.00001)N0=a0;else n0=a0}E0=N0,h0=!0;break}}if(!h0)E0=T,T0=_0}if(G0(E0),E5(H,k,l0),E5(H,K,c),$.q[k].copy(l0),$.q[K].copy(c),h[J.name]=(h[J.name]||z1()).copy(v0),$.fk(k),h0)T0=0;if(T0>0.00001)oE($,J,U<=q?M:d,30);if(Q.endQ)iE($,J,Q.endQ);return $.wp[w].distanceTo(M)}function oE($,J,M,Q){let{rig:H}=$;for(let k=0;k<Q;k++){for(let K of[J.mid,J.root]){let w=$.wp[K],W=m8.subVectors($.wp[J.end],w),E=n$.subVectors(M,w);if(W.lengthSq()<0.000000000001||E.lengthSq()<0.000000000001)continue;let R=m5.setFromUnitVectors(W.normalize(),E.normalize()),Z=d8.copy(R).multiply($.wq[K]),U=nQ.copy($.wq[i1[K]]).invert().multiply(Z);$.q[K].copy(E5(H,K,U)),$.fk(K)}if($.wp[J.end].distanceToSquared(M)<0.0000000001)break}}function iE($,J,M){let Q=uE.copy($.wq[J.mid]).invert().multiply(M);$.q[J.end].copy(E5($.rig,J.end,Q)),$.fk(J.end)}function s$($,J=z1()){return J.set(0,$.rig.h*0.45,0).applyQuaternion($.wq[a.head]).add($.wp[a.head])}function t7($,J,M,Q,H,k={}){let{rig:K}=$,w=k.iters??24,W=k.tol??0.00001,E=z1(),R=()=>E.copy(Q).applyQuaternion($.wq[M]).add($.wp[M]);$.fk();for(let Z=0;Z<w;Z++){for(let U=J.length-1;U>=0;U--){let X=J[U],G=$.wp[X],q=R(),Y=m8.subVectors(q,G),N=n$.subVectors(H,G);if(Y.lengthSq()<0.000000000001||N.lengthSq()<0.000000000001)continue;let V=m5.setFromUnitVectors(Y.normalize(),N.normalize()),D=k.weights?k.weights[U]:1;V.copy(sQ).slerp(V,D).multiply($.wq[X]),d8.copy($.wq[i1[X]]).invert().multiply(V),$.q[X].copy(E5(K,X,d8)),$.fk(X)}if(R().distanceToSquared(H)<W*W)break}return R().distanceTo(H)}var oQ=[a.spine1,a.spine2,a.spine3,a.neck],iQ=[0.8,0.8,0.8,0.6],rQ=[a.spine1,a.spine2];function aQ($,J,M,Q){$.fk();let H=m8.subVectors($.wp[M],$.wp[J]).normalize(),k=n$.subVectors(Q,$.wp[J]).normalize(),K=m5.setFromUnitVectors(H,k).multiply($.wq[J]),w=d8.copy($.wq[i1[J]]).invert().multiply(K);$.q[J].copy(E5($.rig,J,w)),$.fk(J)}function tQ($,J,M){if($.fk(),J===0)$.rootQ.premultiply(M).normalize();else{let Q=m5.copy(M).multiply($.wq[J]),H=d8.copy($.wq[i1[J]]).invert().multiply(Q);$.q[J].copy(E5($.rig,J,H))}$.fk()}function eQ($){$.fk();for(let J=0;J<4;J++){let M=!1;for(let Q of A1){let H=$.pins[Q];if(!H)continue;let k=U8[Q],K=($.rig.len[k.mid]+$.rig.len[k.end])*0.998,w=m8.subVectors(H.p,$.wp[k.root]),W=w.length();if(W>K)$.rootP.addScaledVector(w.divideScalar(W),W-K),$.fk(),M=!0}if(!M)break}}function u8($,J){for(let M of A1){let Q=$.pins[M];if(!Q||M===J)continue;_5($,U8[M],Q.p,{endQ:Q.q,assist:U8[M].kind==="arm"})}}function $H($,J,M){if($.fk(),!M){$.pins[J]=null;return}let Q=U8[J];$.pins[J]={p:$.wp[Q.end].clone(),q:$.wq[Q.end].clone()}}function JH($){a7.delete($)}var e7=["open","relaxed","fist","grip","point","spread"],k5=Math.PI/180,MH=($)=>[-$[0],$[1],$[2]],rE={open:{m:4,p:4,d:2,spread:0,thumb:[4,6,4]},relaxed:{m:16,p:24,d:14,spread:0,thumb:[10,12,12]},fist:{m:82,p:98,d:68,spread:0,thumb:[28,38,42]},grip:{m:62,p:80,d:52,spread:0,thumb:[30,30,34]},point:{m:4,p:4,d:2,spread:0,thumb:[10,14,14]},spread:{m:0,p:2,d:0,spread:11,thumb:[4,2,2]}};function o$($,J,M){let{rig:Q}=$,H=rE[M];D5.forEach((k,K)=>{let w=a[`${k}1${J}`],W=a[`${k}2${J}`],E=a[`${k}3${J}`];if(k==="thumb"){let[G,q,Y]=H.thumb;V6(Q,w,-G*0.8,0,0,$.q[w]),d5(Q,W,q*k5,0,$.q[W]),d5(Q,E,Y*k5,0,$.q[E]);return}let R=K-2.5,Z=H.m,U=H.p,X=H.d;if(M==="point"&&k!=="index")Z=82,U=98,X=68;if(M==="relaxed"){let G=1+(K-1)*0.12;Z*=G,U*=G,X*=G}V6(Q,w,-Z,-R*H.spread*0.9,0,$.q[w]),d5(Q,W,U*k5,0,$.q[W]),d5(Q,E,X*k5,0,$.q[E]);for(let G of[w,W,E])E5(Q,G,$.q[G])}),$.fk()}var HH={t:[1,-0.45,0.05],hand:"relaxed"},C6={stand:{armL:HH,armR:"mirror"},relaxed:{root:{dy:-0.05,yaw:8,roll:3},spine:[3,-3,-4],neck:[4,3,-4],head:[4,0,-3],armL:{t:[0.95,-0.4,0.18],hand:"relaxed",wrist:[0,0,0]},armR:{t:[-0.8,-0.1,0.55],hand:"relaxed",twist:-20,pole:[-0.5,-0.6,-0.4]},legL:{t:[0.62,0.34,0.3],frame:"floor",foot:{yaw:12}},legR:{t:[-0.34,0.34,-0.2],frame:"floor",foot:{yaw:-14}}},walk:{root:{dy:-0.18,pitch:4},spine:[3,0,14],neck:[0,0,-6],head:[2,0,-5],armL:{t:[0.95,-0.75,-0.7],hand:"relaxed",pole:[0.3,0,-1]},armR:{t:[-0.95,-0.55,0.9],hand:"relaxed",pole:[-0.3,-0.6,-1]},legL:{t:[0.38,0.5,1.55],frame:"floor",foot:{pitch:-18}},legR:{t:[-0.38,0.85,-1.5],frame:"floor",foot:{pitch:48}}},run:{root:{dy:0.1,pitch:14},spine:[4,0,18],neck:[-6,0,-8],head:[-8,0,-6],armL:{t:[0.85,0.95,-0.4],hand:"fist",pole:[0.4,-0.4,-1],wrist:[0,0,0]},armR:{t:[-0.6,1.9,1.05],hand:"fist",pole:[-0.3,-1,0]},legL:{t:[0.42,1.55,1.25],frame:"floor",foot:{pitch:-8}},legR:{t:[-0.42,2,-2.1],frame:"floor",foot:{pitch:60}}},"sit on floor":{root:{y:0.52,pitch:-6},spine:[8,0,0],neck:[4,0,0],head:[-4,0,0],armL:{t:[0.6,0.1,1.45],hand:"relaxed",pole:[0.4,-0.4,-1],frame:"body"},armR:"mirror",legL:{t:[0.55,0.34,3.15],frame:"floor",pole:[0.1,1,0.2],foot:{pitch:-20,yaw:8}},legR:"mirror"},"sit on chair":{root:{y:2.55,pitch:3},spine:[4,0,0],neck:[2,0,0],head:[-3,0,0],armL:{t:[0.62,0.15,1.15],hand:"relaxed",pole:[0.5,-0.6,-1]},armR:"mirror",legL:{t:[0.5,0.34,1.95],frame:"floor",foot:{yaw:6}},legR:"mirror"},kneel:{root:{y:2.35,pitch:6,yaw:-12},spine:[4,0,8],neck:[4,0,0],head:[-2,0,0],armL:{t:[0.62,-0.5,1.5],hand:"relaxed",pole:[0.6,-0.8,-0.5]},armR:{t:[-0.75,-0.45,0.35],hand:"fist"},legL:{t:[0.5,0.34,2],frame:"floor",pole:[0.3,0.6,1]},legR:{t:[-0.45,0.34,-1.55],frame:"floor",pole:[-0.1,0.4,1],foot:{pitch:75}}},crouch:{root:{y:1.7,pitch:24},spine:[25,0,0],neck:[-12,0,0],head:[-18,0,0],armL:{t:[0.55,0.2,1.8],hand:"relaxed",pole:[0.4,-1,-0.3]},armR:"mirror",legL:{t:[0.8,0.34,0.6],frame:"floor",pole:[0.9,0.2,1],foot:{yaw:18}},legR:"mirror"},jump:{root:{y:5.35,pitch:-4},spine:[-4,0,0],neck:[-6,0,0],head:[-8,0,0],armL:{t:[1.7,4.5,0.3],hand:"spread",pole:[0.5,-0.4,-1]},armR:"mirror",legL:{t:[0.6,1.75,-0.5],frame:"floor",pole:[0.2,0.1,1],foot:{pitch:40}},legR:{t:[-0.45,1.35,0.55],frame:"floor",pole:[-0.2,0.1,1],foot:{pitch:30}}},"arms raised":{armL:{t:[1.3,4.5,0.2],hand:"open",pole:[0.4,-0.5,-1]},armR:"mirror",head:[-6,0,0]},"hands on hips":{armL:{t:[0.72,0.1,0.5],hand:"relaxed",pole:[1,0,-0.3],wrist:[-10,0,0],twist:-10},armR:"mirror"},"fighting stance":{root:{dy:-0.38,yaw:-35,pitch:8},spine:[6,0,-10],neck:[8,0,10],head:[6,0,8],armL:{t:[0.5,2.05,1.4],hand:"fist",pole:[0.2,-1,-0.2]},armR:{t:[-0.5,2.25,0.95],hand:"fist",pole:[-0.3,-1,-0.2]},legL:{t:[0.55,0.34,1.35],frame:"floor",pole:[0.3,0.2,1],foot:{yaw:-15}},legR:{t:[-0.55,0.34,-0.95],frame:"floor",pole:[-0.3,0.2,1],foot:{yaw:-40}}},"sword two-hand hold":{root:{dy:-0.22,yaw:-10},spine:[3,0,0],neck:[3,0,0],head:[0,0,0],armL:{t:[0.14,1.5,1.3],hand:"grip",pole:[0.8,-1,-0.3],wrist:[0,0,0]},armR:{t:[-0.1,1.05,1.2],hand:"grip",pole:[-0.8,-1,-0.3]},legL:{t:[0.6,0.34,0.6],frame:"floor",pole:[0.2,0.2,1],foot:{yaw:10}},legR:{t:[-0.5,0.34,-0.55],frame:"floor",pole:[-0.2,0.2,1],foot:{yaw:-20}}},"casting a spell with one arm extended":{root:{dy:-0.15,yaw:-14,roll:2},spine:[0,0,-12],neck:[-2,0,8],head:[0,0,10],armL:{t:[0.78,1.3,0.8],hand:"fist",pole:[0.8,-1,-0.5]},armR:{t:[-0.55,2.4,2.3],hand:"spread",pole:[-0.3,-1,0],twist:-80,wrist:[30,0,0]},legL:{t:[0.62,0.34,0.9],frame:"floor",pole:[0.1,0.2,1],foot:{yaw:8}},legR:{t:[-0.45,0.34,-0.7],frame:"floor",pole:[-0.1,0.2,1],foot:{yaw:-20}}},"reaching up":{root:{dy:0.08,pitch:-4},spine:[-6,0,4],neck:[-14,0,0],head:[-22,0,0],armR:{t:[-0.45,4.65,0.5],hand:"open",pole:[-0.3,-0.4,-1]},armL:{t:[1,-0.45,0.05],hand:"relaxed"},legL:{t:[0.4,0.62,0],frame:"floor",foot:{pitch:38}},legR:"mirror"},"lying down":{root:{y:0.55,pitch:-90},armL:{t:[1.05,-0.45,0.08],hand:"relaxed",twist:-10},armR:"mirror",legL:{t:[0.46,-3.62,0.05],frame:"body",foot:{yaw:10}},legR:"mirror"},"A-pose":{armL:{t:[2.6,0.15,0],hand:"open",twist:-20},armR:"mirror"},"T-pose":{armL:{t:[3.7,1.95,-0.04],hand:"open",twist:0},armR:"mirror"}},c8=Object.keys(C6),$J="stand";function kH($){return $.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}var aE=Object.fromEntries(c8.map(($)=>[kH($),$]));function i$($){return C6[$]?$:aE[kH($)]||null}var QH=($)=>({...$,t:MH($.t),pole:$.pole?MH($.pole):void 0,foot:$.foot?{...$.foot,yaw:-($.foot.yaw??0),roll:-($.foot.roll??0)}:void 0});function JJ($,J){let{rig:M}=$,Q=M.h,H=$.rootP.x,k=$.rootP.z;for(let R of $.q)R.set(0,0,0,1);$.pins={footL:null,footR:null,handL:null,handR:null};let K=J.root||{};$.rootQ.setFromEuler(new u1((K.pitch??0)*k5,(K.yaw??0)*k5,(K.roll??0)*k5,"YXZ"));let w=new m0().setFromAxisAngle(new A(0,1,0),(K.yaw??0)*k5);$.rootP.set(H,K.y!==void 0?K.y*Q:M.rest[0].y+(K.dy??0)*Q,k),JH($),$.fk();let W=(R,Z,U)=>{if(!U)return;R.forEach((X,G)=>V6(M,X,U[0]*Z[G],U[1]*Z[G],U[2]*Z[G],$.q[X]))};W([a.spine1,a.spine2,a.spine3],[0.3,0.35,0.35],J.spine),W([a.neck],[1],J.neck),W([a.head],[1],J.head),$.fk();let E=(R,Z)=>{if(Z==="floor"){let U=new A(R[0]*Q,0,R[2]*Q).applyQuaternion(w);return new A($.rootP.x+U.x,R[1]*Q,$.rootP.z+U.z)}return new A(R[0]*Q,R[1]*Q,R[2]*Q).applyQuaternion($.rootQ).add($.rootP)};for(let R of["L","R"]){let Z=R==="L"?1:-1,U=J[`leg${R}`],G=(U==="mirror"?QH(J.legL):U)||{t:[Z*(M.hipHalf/Q),M.ankleY/Q,0],frame:"floor"},q=G.frame??"floor",Y=E(G.t,q),N=q==="floor"?w:$.rootQ,V=G.foot||{},D=N.clone().multiply(new m0().setFromEuler(new u1((V.pitch??0)*k5,(V.yaw??0)*k5,(V.roll??0)*k5,"YXZ"))),P=G.pole?new A(...G.pole):null;_5($,R5[`leg${R}`],Y,{pole:P,endQ:D,spring:0}),_5($,R5[`leg${R}`],Y,{pole:P,endQ:D,spring:0})}for(let R of["L","R"]){let Z=J[`arm${R}`],X=(Z==="mirror"?QH(J.armL):Z)||HH,G=R==="L"?X:X,q=a[`elbow${R}`];d5(M,q,0,(G.twist??0)*k5,$.q[q]);let Y=E(G.t,"body"),N=G.pole?new A(...G.pole):null;_5($,R5[`arm${R}`],Y,{pole:N,spring:0}),_5($,R5[`arm${R}`],Y,{pole:N,spring:0});let V=G.wrist||[0,0,0];V6(M,a[`wrist${R}`],V[0],V[1],V[2],$.q[a[`wrist${R}`]]),$.fk(),o$($,R,G.hand??"relaxed")}$.fk()}function _6($,J){let M=i$(J);if(!M)return!1;return JJ($,C6[M]),!0}var o8=4,KH=100,n8=($)=>Math.round($*1e4)/1e4+0,MJ=($)=>Math.round($*1e5)/1e5+0,s8=($)=>Math.round($*1000)/1000+0;function QJ($){let J=$.w<0?-1:1,M=Math.hypot($.x,$.y,$.z,$.w)||1;return[MJ($.x*J/M),MJ($.y*J/M),MJ($.z*J/M)]}function HJ($,J){if(!$||$.length<3||$.some((K)=>!Number.isFinite(K)))return J.set(0,0,0,1);let M=$[0],Q=$[1],H=$[2],k=M*M+Q*Q+H*H;if(k>1){let K=1/Math.sqrt(k);return J.set(M*K,Q*K,H*K,0)}return J.set(M,Q,H,Math.sqrt(1-k))}function wH($){let J=$.q.map((K)=>K.clone());for(let K=0;K<X1;K++)b$($.q[K].copy(J[n7[K]]));b$($.rootQ);let M=$.rootP.x,Q=$.pins,H={footL:"footR",footR:"footL",handL:"handR",handR:"handL"},k={footL:null,footR:null,handL:null,handR:null};for(let K of A1){let w=Q[K];if(!w)continue;k[H[K]]={p:new A(2*M-w.p.x,w.p.y,w.p.z),q:b$(w.q.clone())}}$.pins=k,$.fk()}class r${persons=[];selected=0;nextId=1;undoStack=[];redoStack=[];pending=null;clipboard=null;constructor($=!0){if($)this.addPerson(!1)}get($){return this.persons.find((J)=>J.id===($??this.selected))||this.persons[0]||null}addPerson($=!0){if(this.persons.length>=o8)return null;if($)this.push();let J=new Set(this.persons.map((K)=>K.color)),M=0;while(J.has(M))M++;let Q=new B6(this.persons.length?this.persons[this.persons.length-1].body.rig.props:v$),H=this.nextId++,k=[0,0.95,-0.95,1.9];return Q.rootP.x=k[this.persons.length]??0,_6(Q,$J),this.persons.push({id:H,color:M,body:Q}),this.selected=H,H}removePerson($){if(this.persons.length<=1)return!1;let J=this.persons.findIndex((M)=>M.id===$);if(J<0)return!1;if(this.push(),this.persons.splice(J,1),this.selected===$)this.selected=this.persons[Math.min(J,this.persons.length-1)].id;return!0}selectPerson($){if(!this.persons.some((J)=>J.id===$))return!1;return this.selected=$,!0}preset($,J){let M=this.get(J);if(!M)return!1;return this.push(),_6(M.body,$)}applySpec($,J){let M=this.get(J);if(!M)return!1;return this.push(),JJ(M.body,$),!0}resetPose($){let J=this.get($);if(!J)return;this.push(),_6(J.body,$J)}mirror($){let J=this.get($);if(!J)return;this.push(),wH(J.body)}setProportions($,J){let M=this.get(J);if(!M)return;M.body.setProps($)}copyPose($){let J=this.get($);if(!J)return;this.clipboard={q:J.body.q.map((M)=>M.clone()),rootQ:J.body.rootQ.clone(),y:J.body.rootP.y,props:J.body.rig.props}}pastePose($){let J=this.get($),M=this.clipboard;if(!J||!M)return!1;this.push();for(let Q=0;Q<X1;Q++)J.body.q[Q].copy(M.q[Q]);return J.body.rootQ.copy(M.rootQ),J.body.rootP.y+=M.y-J.body.rootP.y,J.body.pins={footL:null,footR:null,handL:null,handR:null},J.body.fk(),!0}snapshot(){return JSON.stringify(this.getPose())}push(){if(this.undoStack.push(this.snapshot()),this.undoStack.length>KH)this.undoStack.shift();this.redoStack.length=0}begin(){this.pending=this.snapshot()}end(){if(this.pending===null)return!1;let $=this.pending!==this.snapshot();if($){if(this.undoStack.push(this.pending),this.undoStack.length>KH)this.undoStack.shift();this.redoStack.length=0}return this.pending=null,$}undo(){let $=this.undoStack.pop();if($===void 0)return!1;return this.redoStack.push(this.snapshot()),this.restore($),!0}redo(){let $=this.redoStack.pop();if($===void 0)return!1;return this.undoStack.push(this.snapshot()),this.restore($),!0}restore($){let J=this.selected;if(this.setPose(JSON.parse($)),this.persons.some((M)=>M.id===J)&&!this.persons.some((M)=>M.id===this.selected))this.selected=J}getPose(){let $=this.persons.map(({id:J,color:M,body:Q})=>{let H={};for(let w=1;w<X1;w++){let W=QJ(Q.q[w]);if(W[0]!==0||W[1]!==0||W[2]!==0)H[P1[w]]=W}let k={id:J,c:M,p:[n8(Q.rootP.x),n8(Q.rootP.y),n8(Q.rootP.z)],r:QJ(Q.rootQ),j:H,pr:{h:s8(Q.rig.props.headsTall),H:s8(Q.rig.props.height),s:s8(Q.rig.props.shoulder),w:s8(Q.rig.props.hip),l:s8(Q.rig.props.limb),x:s8(Q.rig.props.sex)}},K={};for(let w of A1){let W=Q.pins[w];if(W)K[w]={p:[n8(W.p.x),n8(W.p.y),n8(W.p.z)],r:QJ(W.q)}}if(Object.keys(K).length)k.pin=K;return k});return{v:1,sel:this.selected,fig:$}}setPose($){let J=typeof $==="string"?JSON.parse($):$;if(!J||J.v!==1||!Array.isArray(J.fig)||J.fig.length===0)throw Error("Invalid pose data");let M=[],Q=0;for(let H of J.fig.slice(0,o8)){let k=new B6(z6({headsTall:H.pr?.h,height:H.pr?.H,shoulder:H.pr?.s,hip:H.pr?.w,limb:H.pr?.l,sex:H.pr?.x})),K=H.p||[0,0,0];k.rootP.set(K[0]||0,K[1]||0,K[2]||0),HJ(H.r,k.rootQ);for(let W=1;W<X1;W++){let E=H.j?.[P1[W]];if(E)HJ(E,k.q[W])}for(let W of A1){let E=H.pin?.[W];if(E)k.pins[W]={p:new A(E.p[0],E.p[1],E.p[2]),q:HJ(E.r,new m0)}}k.fk();let w=Number.isInteger(H.id)?H.id:M.length+1;Q=Math.max(Q,w),M.push({id:w,color:Number.isInteger(H.c)?Math.abs(H.c)%o8:M.length,body:k})}this.persons=M,this.nextId=Math.max(this.nextId,Q+1),this.selected=M.some((H)=>H.id===J.sel)?J.sel:M[0].id}}function kJ($){let J=JSON.stringify($);return(typeof btoa==="function"?btoa(unescape(encodeURIComponent(J))):Buffer.from(J).toString("base64")).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}function A6($){let J=$.trim();if(J.startsWith("{"))return JSON.parse(J);let M=J.replace(/-/g,"+").replace(/_/g,"/"),Q=M+"=".repeat((4-M.length%4)%4),H=typeof atob==="function"?decodeURIComponent(escape(atob(Q))):Buffer.from(Q,"base64").toString();return JSON.parse(H)}var tE=[[5,7],[7,9],[6,8],[8,10],[11,13],[13,15],[12,14],[14,16],[5,6],[11,12],[5,11],[6,12],[0,5],[0,6]],WH=[[255,0,0],[255,128,0],[255,255,0],[128,255,0],[0,255,0],[0,255,128],[0,255,255],[0,128,255],[0,0,255],[128,0,255],[255,0,255],[255,0,128],[180,180,180],[220,220,220]],EH=[0,255,255],eE=[...WH,[255,255,255],EH,[0,0,0]],W1=($,J=0,M=0,Q=0)=>({j:$,o:new A(J,M,Q)}),S6=new A;function $Z($){let J=$.rig.h,M=a.head,Q=[W1(M,0,0.39*J,0.53*J),W1(M,0.17*J,0.55*J,0.41*J),W1(M,-0.17*J,0.55*J,0.41*J),W1(M,0.38*J,0.43*J,0.01*J),W1(M,-0.38*J,0.43*J,0.01*J),W1(a.shoulderL),W1(a.shoulderR),W1(a.elbowL),W1(a.elbowR),W1(a.wristL),W1(a.wristR),W1(a.hipL),W1(a.hipR),W1(a.kneeL),W1(a.kneeR),W1(a.ankleL),W1(a.ankleR)],H=[];for(let[K,w]of[["L",1],["R",-1]]){let W=$.rig.tip[a[`toe${K}`]];H.push(W1(a[`toe${K}`],-w*0.07*J,W.y,W.z),W1(a[`toe${K}`],w*0.12*J,-0.05*J,0.2*J),W1(a[`ankle${K}`],0,-0.21*J,-0.27*J))}let k=(K)=>{let w=[W1(a[`wrist${K}`])];for(let W of D5){w.push(W1(a[`${W}1${K}`]),W1(a[`${W}2${K}`]),W1(a[`${W}3${K}`]));let E=$.rig.tip[a[`${W}3${K}`]];w.push(W1(a[`${W}3${K}`],E.x,E.y,E.z))}return w};return{coco:Q,feet:H,handL:k("L"),handR:k("R")}}function JZ($,J,M){S6.copy(J.o).applyQuaternion($.wq[J.j]).add($.wp[J.j]).project(M);let Q=(S6.x+1)/2,H=(1-S6.y)/2;if(S6.z>1||S6.z<-1)return{x:Q,y:H,v:0};return{x:Q,y:H,v:Q>=0&&Q<=1&&H>=0&&H<=1?2:1}}function KJ($,J,M=0){$.fk(),J.updateMatrixWorld();let Q=$Z($),H=(k)=>k.map((K)=>JZ($,K,J));return{id:M,body:H(Q.coco),feet:H(Q.feet),handL:H(Q.handL),handR:H(Q.handR)}}function wJ($,J,M,Q={}){let H=Q.hands??!0,k=Q.face??!0,K=Q.scale??1,w=new Uint8ClampedArray(J*M*4);for(let G=3;G<w.length;G+=4)w[G]=255;let W=(G,q,Y)=>{let N=(q*J+G)*4;w[N]=Y[0],w[N+1]=Y[1],w[N+2]=Y[2]},E=(G,q,Y,N)=>{let V=Math.max(0,Math.floor(G-Y)),D=Math.min(J-1,Math.ceil(G+Y)),P=Math.max(0,Math.floor(q-Y)),h=Math.min(M-1,Math.ceil(q+Y)),B=Y*Y;for(let S=P;S<=h;S++)for(let b=V;b<=D;b++){let z=b+0.5-G,O=S+0.5-q;if(z*z+O*O<=B)W(b,S,N)}},R=(G,q,Y,N,V,D)=>{let P=V/2,h=Math.max(0,Math.floor(Math.min(G,Y)-P)),B=Math.min(J-1,Math.ceil(Math.max(G,Y)+P)),S=Math.max(0,Math.floor(Math.min(q,N)-P)),b=Math.min(M-1,Math.ceil(Math.max(q,N)+P)),z=Y-G,O=N-q,f=z*z+O*O||0.000000001;for(let g=S;g<=b;g++)for(let p=h;p<=B;p++){let u=p+0.5-G,t=g+0.5-q,m=Math.max(0,Math.min(1,(u*z+t*O)/f)),e=u-m*z,d=t-m*O;if(e*e+d*d<=P*P)W(p,g,D)}},Z=Math.max(1,2*K),U=Math.max(1,3*K),X=Math.max(1,2*K);for(let G of $){tE.forEach(([q,Y],N)=>{let V=G.body[q],D=G.body[Y];if(V.v===0||D.v===0)return;R(V.x*J,V.y*M,D.x*J,D.y*M,Z,WH[N%14])}),G.body.forEach((q,Y)=>{if(q.v===0||!k&&Y>=1&&Y<=4)return;E(q.x*J,q.y*M,U,[255,255,255])});for(let q of G.feet)if(q.v!==0)E(q.x*J,q.y*M,X,[255,255,255]);if(H){for(let q of[G.handL,G.handR])for(let Y of q)if(Y.v!==0)E(Y.x*J,Y.y*M,X,EH)}}return{data:w,width:J,height:M}}var i8={genman:{headsTall:7.8,height:1.82,shoulder:1.15,hip:0.92,limb:1.03,sex:1},genwoman:{headsTall:7.4,height:1.66,shoulder:0.92,hip:1.12,limb:1,sex:0},"tall man":{headsTall:8.1,height:1.97,shoulder:1.18,hip:0.9,limb:1.1,sex:1},"stocky man":{headsTall:7,height:1.74,shoulder:1.32,hip:1.15,limb:0.92,sex:1},"slim woman":{headsTall:8,height:1.72,shoulder:0.82,hip:0.85,limb:1.08,sex:0},"short woman":{headsTall:7,height:1.52,shoulder:0.9,hip:1.18,limb:0.93,sex:0},"curvy woman":{headsTall:7.2,height:1.64,shoulder:0.95,hip:1.32,limb:0.96,sex:0},"teen boy":{headsTall:7.2,height:1.62,shoulder:0.88,hip:0.85,limb:1.02,sex:0.75},"teen girl":{headsTall:7.2,height:1.58,shoulder:0.82,hip:0.95,limb:1.02,sex:0.25},child:{headsTall:6.5,height:1.25,shoulder:0.78,hip:0.82,limb:0.85,sex:0.5},neutral:{headsTall:7.5,height:1.7,shoulder:1,hip:1,limb:1,sex:0.5}},MZ=Object.keys(i8);var a$=[[1024,1024],[768,1024],[1024,768],[768,768],[640,1024],[1024,640],[832,1216],[1216,832],[896,1152],[1152,896],[512,512],[512,768],[768,512]],EJ={front:{az:0,el:4},"3/4 left":{az:38,el:8},"3/4 right":{az:-38,el:8},side:{az:90,el:4},back:{az:180,el:4},top:{az:0,el:86},"low angle":{az:12,el:-24},"high angle":{az:12,el:36}},t$=Object.keys(EJ),a8=["mesh","skeleton","depth","region"],q5={pelvis:"#ffb454",chest:"#d6a8ff",head:"#7ab8ff",hand:"#76dcc0",foot:"#76dcc0",elbow:"#f7e07a",knee:"#f7e07a",floor:"#9fb3ae",joint:"#e8f3f0"},WJ=new A(0,1,0),T6=new A,r8=new A,ZH=new m0,RH=new m0;class u5{container;model=new r$;listeners=new Map;root;canvas;overlay;ctx;msg;gpu=null;cam=new L1(35,1,0.05,100);view={az:0,el:4,dist:4.4,target:new A(0,0.9,0),fov:35};out=[768,1024];cw=1;ch=1;dpr=1;guide={x:0,y:0,w:1,h:1};dirty=!0;raf=0;mode="ik";depthMode=!1;showGrid=!0;showShadow=!0;showBones=!0;selJoint=null;handles=[];hover=null;pointers=new Map;drag=null;gesture=null;ro=null;destroyed=!1;changePending=!1;pixelRatioOpt;webgl=!0;ready=!1;onResizeBound=()=>this.resize();constructor($,J={}){this.container=$;this.root=document.createElement("div"),this.root.tabIndex=0,this.root.setAttribute("role","application"),this.root.setAttribute("aria-label","3D pose editor. Drag handles to pose the figure. Ctrl+Z undo, M mirror, R reset, 1 to 4 select figure."),Object.assign(this.root.style,{position:"relative",width:"100%",height:"100%",overflow:"hidden",touchAction:"none",outline:"none",userSelect:"none",background:"radial-gradient(ellipse at 50% 30%, #14201f 0%, #0a1011 70%)"}),this.canvas=document.createElement("canvas"),this.overlay=document.createElement("canvas");for(let M of[this.canvas,this.overlay])Object.assign(M.style,{position:"absolute",inset:"0",width:"100%",height:"100%",display:"block"});if(this.overlay.style.touchAction="none",this.msg=document.createElement("div"),Object.assign(this.msg.style,{position:"absolute",inset:"0",display:"none",alignItems:"center",justifyContent:"center",textAlign:"center",padding:"24px",color:"#c8d9d5",font:"14px system-ui, sans-serif",background:"rgba(7,10,11,.9)"}),this.root.append(this.canvas,this.overlay,this.msg),$.appendChild(this.root),this.ctx=this.overlay.getContext("2d"),this.pixelRatioOpt=J.pixelRatio,J.width&&J.height)this.out=[J.width,J.height];if(J.fov)this.view.fov=J.fov;if(J.grid!==void 0)this.showGrid=J.grid;if(J.shadow!==void 0)this.showShadow=J.shadow;if(J.bones!==void 0)this.showBones=J.bones;if(J.mode)this.mode=J.mode;if(J.pose)try{this.model.setPose(typeof J.pose==="string"?A6(J.pose):J.pose)}catch(M){this.emit("error",M)}this.initGpu(),this.bind(),this.resize(),this.frameFigures(),this.ro=typeof ResizeObserver<"u"?new ResizeObserver(this.onResizeBound):null,this.ro?.observe(this.root),this.loop(),queueMicrotask(()=>{if(!this.destroyed)this.ready=!0,this.emit("ready"),this.emitState()})}initGpu(){try{if(!document.createElement("canvas").getContext("webgl2"))throw Error("WebGL2 is not available");this.gpu=new r7(this.canvas),this.canvas.addEventListener("webglcontextlost",(J)=>{if(J.preventDefault(),this.gpu)this.gpu.lost=!0;this.showMessage("Graphics context lost. Restoring..."),this.emit("contextlost")}),this.canvas.addEventListener("webglcontextrestored",()=>{if(this.gpu)this.gpu.lost=!1;this.showMessage(""),this.dirty=!0,this.emit("contextrestored")})}catch($){this.webgl=!1,this.gpu=null,this.showMessage("3D preview needs WebGL2, which this browser or device does not provide. Pose data and the skeleton map still work. Try a recent Chrome, Edge, Firefox or Safari with hardware acceleration enabled."),this.emit("error",$)}}showMessage($){this.msg.textContent=$,this.msg.style.display=$?"flex":"none"}on($,J){let M=this.listeners.get($);if(!M)this.listeners.set($,M=new Set);if(M.add(J),$==="ready"&&this.ready)queueMicrotask(()=>J());return()=>this.off($,J)}off($,J){this.listeners.get($)?.delete(J)}emit($,J){this.listeners.get($)?.forEach((M)=>{try{M(J)}catch{}})}emitState(){if(!this.ready)return;this.emit("state",this.getState())}changed(){if(this.dirty=!0,this.changePending)return;this.changePending=!0,requestAnimationFrame(()=>{if(this.changePending=!1,this.destroyed)return;this.emit("change",this.model.getPose()),this.emitState()})}getState(){let $=this.model.get(),J={footL:!1,footR:!1,handL:!1,handR:!1};if($)for(let M of A1)J[M]=!!$.body.pins[M];return{people:this.model.persons.map((M)=>({id:M.id,color:M.color})),selected:this.model.selected,mode:this.mode,pins:J,canUndo:this.model.undoStack.length>0,canRedo:this.model.redoStack.length>0,canPaste:!!this.model.clipboard,props:{...$?.body.rig.props},fov:this.view.fov,size:[...this.out],grid:this.showGrid,shadow:this.showShadow,bones:this.showBones,depthMode:this.depthMode,selectedJoint:this.selJoint===null?null:P1[this.selJoint],webgl:this.webgl}}sel(){return this.model.get()}setMode($){this.mode=$,this.selJoint=$==="fk"?this.selJoint:null,this.dirty=!0,this.emitState()}getMode(){return this.mode}setDepthMode($){this.depthMode=$,this.emitState()}setShowGrid($){this.showGrid=$,this.dirty=!0,this.emitState()}setShowShadow($){this.showShadow=$,this.dirty=!0,this.emitState()}setShowBones($){this.showBones=$,this.dirty=!0,this.emitState()}setOutputSize($,J){$=Math.max(16,Math.round($/16)*16),J=Math.max(16,Math.round(J/16)*16),this.out=[$,J],this.dirty=!0,this.emitState(),this.changed()}getOutputSize(){return[...this.out]}setFov($){this.view.fov=Math.min(90,Math.max(12,$)),this.dirty=!0,this.emitState(),this.changed()}addPerson(){let $=this.model.addPerson();if($!==null)this.selJoint=null,this.frameFigures(),this.changed(),this.emit("select",$);return $}removePerson($){let J=$??this.model.selected,M=this.model.removePerson(J);if(M)this.selJoint=null,this.changed(),this.emit("select",this.model.selected);return M}selectPerson($){if(this.model.selected===$)return!0;let J=this.model.selectPerson($);if(J)this.selJoint=null,this.dirty=!0,this.emit("select",$),this.emitState();return J}selectIndex($){let J=this.model.persons[$];if(J)this.selectPerson(J.id)}getPeople(){return this.model.persons.map(($)=>({id:$.id,color:$.color,selected:$.id===this.model.selected}))}copyPose(){this.model.copyPose(),this.emitState()}pastePose(){if(this.model.pastePose())this.changed()}placePerson($,J,M){let Q=this.model.get($);if(!Q)return;this.model.push();let H=Q.body,k=J-H.rootP.x,K=M-H.rootP.z;H.rootP.x=J,H.rootP.z=M;for(let w of A1){let W=H.pins[w];if(W)W.p.x+=k,W.p.z+=K}H.fk(),this.changed()}setPreset($){if(!i$($))return!1;return this.model.preset($),this.changed(),!0}applySpec($){let J=this.model.applySpec($);if(J)this.changed();return J}setBodyType($){this.setProportions(i8[$])}getFigure(){let $=this.sel().body;return{x:$.rootP.x,z:$.rootP.z}}transformFigure($){let J=this.sel().body;this.model.push();let M=J.rootP.x,Q=J.rootP.z;if($.yawDeg){let K=new m0().setFromAxisAngle(new A(0,1,0),$.yawDeg*Math.PI/180);J.rootQ.premultiply(K);for(let w of A1){let W=J.pins[w];if(!W)continue;let E=new A(W.p.x-M,0,W.p.z-Q).applyQuaternion(K);W.p.x=M+E.x,W.p.z=Q+E.z,W.q.premultiply(K)}}let H=$.x??M,k=$.z??Q;J.rootP.x=H,J.rootP.z=k;for(let K of A1){let w=J.pins[K];if(w)w.p.x+=H-M,w.p.z+=k-Q}J.fk(),this.changed()}mirror(){this.model.mirror(),this.changed()}reset(){this.model.resetPose(),this.changed()}undo(){let $=this.model.undo();if($)this.selJoint=null,this.changed(),this.emit("select",this.model.selected);return $}redo(){let $=this.model.redo();if($)this.selJoint=null,this.changed(),this.emit("select",this.model.selected);return $}setProportions($){this.model.begin(),this.model.setProportions($),this.model.end(),this.changed()}previewProportions($){this.model.setProportions($),this.changed()}beginEdit(){this.model.begin()}endEdit(){if(this.model.end())this.emitState()}getProportions(){return{...this.sel().body.rig.props}}setHandShape($,J){this.model.push();let M=this.sel().body;if($!=="R")o$(M,"L",J);if($!=="L")o$(M,"R",J);this.changed()}togglePin($){let J=this.sel().body;this.model.push(),$H(J,$,!J.pins[$]),this.changed()}setCameraView($){let J=EJ[$];if(!J)return!1;return this.view.az=J.az*Math.PI/180,this.view.el=J.el*Math.PI/180,this.frameFigures(),this.changed(),!0}frameFigures(){let $=[];for(let P of this.model.persons){P.body.fk();for(let h=0;h<X1;h++)if(!l8(h)||/1[LR]$/.test(P1[h]))$.push(P.body.wp[h])}let{az:J,el:M}=this.view,Q=Math.cos(M),H=new A(Math.sin(J)*Q,Math.sin(M),Math.cos(J)*Q),k=new A().crossVectors(WJ,H).normalize(),K=new A().crossVectors(H,k).normalize(),w=1/0,W=-1/0,E=1/0,R=-1/0;for(let P of $){let h=P.dot(k),B=P.dot(K);w=Math.min(w,h),W=Math.max(W,h),E=Math.min(E,B),R=Math.max(R,B)}let Z=0.2;w-=Z,W+=Z,E-=Z,R+=Z;let U=(w+W)/2,X=(E+R)/2,G=$.reduce((P,h)=>P+h.dot(H),0)/$.length,q=k.clone().multiplyScalar(U).addScaledVector(K,X).addScaledVector(H,G),Y=this.out[0]/this.out[1],N=Math.tan(this.view.fov*Math.PI/360),V=N*Y,D=0.8;for(let P of $){let h=P.clone().sub(q),B=h.dot(H),S=Math.max(Math.abs(h.dot(k))+Z,0)/V+B,b=(Math.abs(h.dot(K))+Z)/N+B;D=Math.max(D,S,b)}this.view.target.copy(q),this.view.dist=Math.min(30,D*1.04),this.dirty=!0}updateCamera(){let{az:$,el:J,dist:M,target:Q}=this.view,H=Math.cos(J);this.cam.position.set(Q.x+M*Math.sin($)*H,Q.y+M*Math.sin(J),Q.z+M*Math.cos($)*H),this.cam.up.copy(WJ),this.cam.lookAt(Q);let k=this.out[0]/this.out[1],K=Math.min(this.ch*0.92,this.cw*0.94/k),w=K*k;this.guide={x:(this.cw-w)/2,y:(this.ch-K)/2,w,h:K},this.cam.fov=2*Math.atan(Math.tan(this.view.fov*Math.PI/360)*this.ch/K)*180/Math.PI,this.cam.aspect=this.cw/this.ch,this.cam.near=0.05,this.cam.far=120,this.cam.updateProjectionMatrix(),this.cam.updateMatrixWorld()}resize(){let $=this.root.getBoundingClientRect();this.cw=Math.max(1,Math.floor($.width)),this.ch=Math.max(1,Math.floor($.height)),this.dpr=this.pixelRatioOpt??Math.min(2,window.devicePixelRatio||1),this.gpu?.setSize(this.cw,this.ch,this.dpr),this.overlay.width=Math.round(this.cw*this.dpr),this.overlay.height=Math.round(this.ch*this.dpr),this.dirty=!0}loop=()=>{if(this.destroyed)return;if(this.raf=requestAnimationFrame(this.loop),!this.dirty)return;this.dirty=!1,this.render()};render(){this.updateCamera();let $=this.gpu;if($&&!$.lost)$.sync(this.model.persons.map((J)=>({id:J.id,body:J.body,color:J.color}))),$.renderView(this.cam,{grid:this.showGrid,shadow:this.showShadow,selected:this.model.persons.length>1?this.model.selected:null,dim:!1});this.drawOverlay()}requestRender(){this.dirty=!0}project($,J={x:0,y:0,z:0}){return r8.copy($).project(this.cam),J.x=(r8.x+1)/2*this.cw,J.y=(1-r8.y)/2*this.ch,J.z=r8.z,J}computeHandles(){let $=this.model.get();if(!$)return[];let J=$.body;J.fk();let M=[];if(this.mode==="ik"){M.push({kind:"pelvis",id:"pelvis",pos:J.wp[a.pelvis].clone(),r:9,color:q5.pelvis}),M.push({kind:"chest",id:"chest",pos:J.wp[a.spine3].clone(),r:7,color:q5.chest}),M.push({kind:"head",id:"head",pos:s$(J),r:9,color:q5.head});for(let k of["L","R"])M.push({kind:"hand",id:`hand${k}`,pos:J.wp[a[`wrist${k}`]].clone(),r:8,color:q5.hand}),M.push({kind:"foot",id:`foot${k}`,pos:J.wp[a[`ankle${k}`]].clone(),r:8,color:q5.foot}),M.push({kind:"elbow",id:`elbow${k}`,pos:J.wp[a[`elbow${k}`]].clone(),r:6,color:q5.elbow}),M.push({kind:"knee",id:`knee${k}`,pos:J.wp[a[`knee${k}`]].clone(),r:6,color:q5.knee});let Q=(J.wp[a.ankleL].x+J.wp[a.ankleR].x)/2,H=(J.wp[a.ankleL].z+J.wp[a.ankleR].z)/2;M.push({kind:"floor",id:"floor",pos:new A(Q,0,H),r:8,color:q5.floor})}else{let Q=this.selJoint!==null&&(l8(this.selJoint)||/^wrist/.test(P1[this.selJoint])),H=this.selJoint!==null?P1[this.selJoint].slice(-1):"";for(let k=0;k<X1;k++)if(l8(k)){if(!Q||P1[k].slice(-1)!==H)continue;M.push({kind:"joint",id:`j${k}`,pos:J.wp[k].clone(),r:4,color:q5.joint,joint:k})}else M.push({kind:"joint",id:`j${k}`,pos:J.wp[k].clone(),r:k===0?8:6,color:q5.joint,joint:k})}return M}drawOverlay(){let $=this.ctx,{dpr:J,cw:M,ch:Q}=this;$.setTransform(J,0,0,J,0,0),$.clearRect(0,0,M,Q);let H=this.guide;$.fillStyle="rgba(4,8,9,0.5)",$.beginPath(),$.rect(0,0,M,Q),$.rect(H.x,H.y,H.w,H.h),$.fill("evenodd"),$.strokeStyle="rgba(118,220,192,0.55)",$.lineWidth=1,$.setLineDash([6,5]),$.strokeRect(H.x+0.5,H.y+0.5,H.w-1,H.h-1),$.setLineDash([]),$.fillStyle="rgba(118,220,192,0.75)",$.font="11px ui-monospace, monospace",$.textBaseline="bottom",$.fillText(`${this.out[0]}×${this.out[1]}`,H.x+6,H.y+H.h-5);let k=this.model.get(),K={x:0,y:0,z:0};if(this.showBones&&k){let W=k.body;$.lineWidth=1.5,$.strokeStyle="rgba(232,243,240,0.28)",$.beginPath();for(let E=1;E<X1;E++){if(l8(E))continue;let R=i1[E];this.project(W.wp[R],K),$.moveTo(K.x,K.y),this.project(W.wp[E],K),$.lineTo(K.x,K.y)}$.stroke()}if(this.model.persons.length>1)this.model.persons.forEach((W,E)=>{let R=s$(W.body,new A).add(new A(0,W.body.rig.h*0.8,0));this.project(R,K);let Z=W.id===this.model.selected;$.fillStyle=Z?"#8ee4ca":"rgba(20,32,31,0.9)",$.strokeStyle=Z?"#8ee4ca":"rgba(142,228,202,0.5)",$.lineWidth=1.5,$.beginPath(),$.arc(K.x,K.y,11,0,Math.PI*2),$.fill(),$.stroke(),$.fillStyle=Z?"#06120f":"#c8d9d5",$.font="700 12px system-ui, sans-serif",$.textAlign="center",$.textBaseline="middle",$.fillText(String(E+1),K.x,K.y+0.5)}),$.textAlign="start";this.handles=this.computeHandles();let w=this.drag?.handle.id??null;for(let W of this.handles){this.project(W.pos,K);let R=w===W.id||this.hover===W.id||W.joint!==void 0&&W.joint===this.selJoint,Z=W.kind==="hand"||W.kind==="foot"?W.id:null,U=Z&&k?.body.pins[Z];if(W.kind==="floor"){$.strokeStyle=W.color,$.lineWidth=R?2.5:1.5,$.beginPath(),$.ellipse(K.x,K.y,22,8,0,0,Math.PI*2),$.stroke();continue}if($.fillStyle=R?"#ffffff":W.color,$.strokeStyle="rgba(5,9,10,0.85)",$.lineWidth=2,$.beginPath(),$.arc(K.x,K.y,W.r+(R?2:0),0,Math.PI*2),$.fill(),$.stroke(),U)$.strokeStyle="#ff6b6b",$.lineWidth=2,$.beginPath(),$.arc(K.x,K.y,W.r+5,0,Math.PI*2),$.stroke()}}hitRadius($){return $?26:16}pick($,J,M){let Q=null,H=1/0,k={x:0,y:0,z:0},K=this.hitRadius(M);for(let w of this.handles){this.project(w.pos,k);let W=Math.hypot(k.x-$,k.y-J);if(w.kind==="floor")W=Math.hypot((k.x-$)/2.4,k.y-J);let E=w.kind==="floor"?K:K+(w.r>7?2:0),R=w.kind==="elbow"||w.kind==="knee"||w.kind==="chest"?1.15:w.kind==="floor"?1.6:1;if(W<=E&&W*R<H)H=W*R,Q=w}return Q}pickPerson($,J,M){let Q={x:0,y:0,z:0},H=M?22:15;if(this.model.persons.length>1)for(let w of this.model.persons){let W=s$(w.body,new A).add(new A(0,w.body.rig.h*0.8,0));if(this.project(W,Q),Math.hypot(Q.x-$,Q.y-J)<=H)return w.id}let k=null,K=M?34:24;for(let w of this.model.persons){if(w.id===this.model.selected)continue;w.body.fk();let W=w.body;for(let E=1;E<X1;E++){if(l8(E))continue;this.project(W.wp[i1[E]],Q);let{x:R,y:Z}=Q;this.project(W.wp[E],Q);let U=Q.x-R,X=Q.y-Z,G=U*U+X*X||1,q=Math.max(0,Math.min(1,(($-R)*U+(J-Z)*X)/G)),Y=Math.hypot(R+q*U-$,Z+q*X-J);if(Y<K)K=Y,k=w.id}}return k}rayAt($,J){let M=T6.set($/this.cw*2-1,-(J/this.ch)*2+1,0.5).unproject(this.cam);return new y8(this.cam.position.clone(),M.sub(this.cam.position).normalize())}bind(){let $=this.overlay;$.addEventListener("pointerdown",this.onDown),$.addEventListener("pointermove",this.onMove),$.addEventListener("pointerup",this.onUp),$.addEventListener("pointercancel",this.onUp),$.addEventListener("pointerleave",()=>{if(this.hover&&!this.drag)this.hover=null,this.dirty=!0}),$.addEventListener("wheel",this.onWheel,{passive:!1}),$.addEventListener("contextmenu",(J)=>J.preventDefault()),$.addEventListener("dblclick",()=>{if(!this.drag)this.frameFigures(),this.dirty=!0}),this.root.addEventListener("keydown",this.onKey)}local($){let J=this.overlay.getBoundingClientRect();return{x:$.clientX-J.left,y:$.clientY-J.top}}onDown=($)=>{this.root.focus({preventScroll:!0});let{x:J,y:M}=this.local($);this.overlay.setPointerCapture($.pointerId),this.pointers.set($.pointerId,{x:J,y:M});let Q=$.pointerType==="touch";if(this.pointers.size===2){this.cancelDrag();let[k,K]=[...this.pointers.values()];this.gesture={kind:"pinch",x:J,y:M,dist:Math.hypot(k.x-K.x,k.y-K.y),cx:(k.x+K.x)/2,cy:(k.y+K.y)/2};return}if(this.pointers.size>2)return;if($.button===0||Q){let k=this.pick(J,M,Q);if(k&&!$.shiftKey){this.startDrag(k,J,M,$);return}let K=this.pickPerson(J,M,Q);if(K!==null&&K!==this.model.selected){this.selectPerson(K);return}if(this.mode==="fk"&&this.selJoint!==null)this.selJoint=null,this.dirty=!0,this.emitState()}let H=$.button===1||$.button===2||$.button===0&&($.shiftKey||$.metaKey);this.gesture={kind:H?"pan":"orbit",x:J,y:M},this.root.style.cursor=H?"move":"grabbing"};startDrag($,J,M,Q){let k=this.sel().body;this.model.begin();let K=this.rayAt(J,M),w=this.cam.getWorldDirection(new A),W=T6.copy($.pos).sub(this.cam.position).dot(w),E=K.origin.clone().addScaledVector(K.direction,W/Math.max(0.000001,K.direction.dot(w))),R={handle:$,offset:$.pos.clone().sub(E),depth:0,d0:W,fwd:w,lx:J,ly:M,moved:!1,startQ:$.kind==="foot"?k.wq[U8[$.id].end].clone():null,headQ:$.kind==="head"?k.wq[a.head].clone():null,pinned:!1,alt:Q.altKey||Q.ctrlKey};if(this.drag=R,$.joint!==void 0)this.selJoint=$.joint,this.emitState();this.root.style.cursor="grabbing",this.dirty=!0}cancelDrag(){if(!this.drag)return;if(this.model.end())this.emitState();this.drag=null}onMove=($)=>{let{x:J,y:M}=this.local($),Q=this.pointers.get($.pointerId);if(Q)Q.x=J,Q.y=M;let H=$.pointerType==="touch";if(this.drag){let k=this.drag,K=M-k.ly,w=J-k.lx;if($.altKey||$.ctrlKey||this.depthMode&&this.mode==="ik"&&k.handle.kind!=="floor")k.depth+=-K*0.004*Math.max(1,k.d0);if(this.mode==="fk")this.fkDrag(k,w,K,$.altKey||$.ctrlKey);else if(!($.altKey||$.ctrlKey||this.depthMode)||k.handle.kind==="floor")this.ikDrag(k,J,M);else this.ikDrag(k,k.lx,k.ly);k.lx=J,k.ly=M,k.moved=!0,this.changed();return}if(this.gesture){let k=this.gesture;if(k.kind==="pinch"&&this.pointers.size===2){let[K,w]=[...this.pointers.values()],W=Math.hypot(K.x-w.x,K.y-w.y),E=(K.x+w.x)/2,R=(K.y+w.y)/2;this.view.dist=Math.min(30,Math.max(0.5,this.view.dist*(k.dist/Math.max(1,W)))),this.panBy(E-k.cx,R-k.cy),k.dist=W,k.cx=E,k.cy=R}else if(k.kind==="orbit")this.view.az-=(J-k.x)*0.0075,this.view.el=Math.max(-1.52,Math.min(1.52,this.view.el+(M-k.y)*0.0075)),k.x=J,k.y=M;else if(k.kind==="pan")this.panBy(J-k.x,M-k.y),k.x=J,k.y=M;this.dirty=!0,this.changed();return}if(!H){let k=this.pick(J,M,!1),K=k?.id??null;if(K!==this.hover)this.hover=K,this.dirty=!0;this.root.style.cursor=k?"grab":"default"}};onUp=($)=>{this.pointers.delete($.pointerId);try{this.overlay.releasePointerCapture($.pointerId)}catch{}if(this.drag){if(this.model.end())this.emitState(),this.changed();this.drag=null}if(this.pointers.size===0)this.gesture=null;else if(this.pointers.size===1&&this.gesture?.kind==="pinch"){let J=[...this.pointers.values()][0];this.gesture={kind:"orbit",x:J.x,y:J.y}}this.root.style.cursor="default",this.dirty=!0};panBy($,J){let H=2*this.view.dist*Math.tan(this.cam.fov*Math.PI/360)/this.ch,k=T6.set(1,0,0).applyQuaternion(this.cam.quaternion),K=r8.set(0,1,0).applyQuaternion(this.cam.quaternion);this.view.target.addScaledVector(k,-$*H).addScaledVector(K,J*H)}onWheel=($)=>{if($.preventDefault(),this.drag){this.drag.depth+=-$.deltaY*0.0015*Math.max(1,this.drag.d0),this.ikDrag(this.drag,this.drag.lx,this.drag.ly),this.changed();return}if($.shiftKey)this.panBy(-$.deltaX-$.deltaY*($.deltaX===0?1:0),0),this.panBy(0,0);let J=$.ctrlKey?0.012:0.0015;if(this.view.dist=Math.min(30,Math.max(0.5,this.view.dist*Math.exp($.deltaY*J))),!$.ctrlKey&&Math.abs($.deltaX)>Math.abs($.deltaY)*1.5)this.panBy(-$.deltaX,0),this.view.dist=Math.min(30,Math.max(0.5,this.view.dist/Math.exp($.deltaY*J)));this.dirty=!0,this.changed()};ikDrag($,J,M){let H=this.sel().body,k=$.handle,K=this.rayAt(J,M),w=new e1().setFromNormalAndCoplanarPoint($.fwd,this.cam.position.clone().addScaledVector($.fwd,$.d0+$.depth)),W=K.intersectPlane(w,new A);if(!W&&k.kind!=="floor")return;let E=W?W.add($.offset):k.pos.clone();if(H.fk(),k.kind==="floor"){let R=new e1(WJ,0),Z=K.intersectPlane(R,new A);if(!Z||K.direction.y>-0.04)return;if(!$.floorStart)$.floorStart={hit:Z.clone(),root:H.rootP.clone(),pins:A1.map((X)=>H.pins[X]?.p.clone()??null)};let U=Z.clone().sub($.floorStart.hit);H.rootP.set($.floorStart.root.x+U.x,H.rootP.y,$.floorStart.root.z+U.z),A1.forEach((X,G)=>{let q=H.pins[X],Y=$.floorStart.pins[G];if(q&&Y)q.p.set(Y.x+U.x,Y.y,Y.z+U.z)}),H.fk(),u8(H);return}switch(k.kind){case"pelvis":H.rootP.copy(E),eQ(H),u8(H);break;case"chest":t7(H,rQ,a.spine3,T6.set(0,0,0),E,{iters:16,weights:[0.9,0.9]}),u8(H);break;case"head":{if(t7(H,oQ,a.head,new A(0,H.rig.h*0.45,0),E,{iters:24,weights:iQ}),$.headQ)ZH.copy(H.wq[a.head]).slerp($.headQ,0.55),RH.copy(H.wq[a.neck]).invert().multiply(ZH),H.q[a.head].copy(RH),H.fk(a.head);u8(H);break}case"hand":case"foot":{let R=k.id,Z=U8[R],U=H.pins[R];if(_5(H,Z,E,{endQ:U?U.q:$.startQ}),U)U.p.copy(H.wp[Z.end]),U.q.copy(H.wq[Z.end]);break}case"elbow":case"knee":{let R=k.id.slice(-1),Z=R5[`${k.kind==="elbow"?"arm":"leg"}${R}`],U=H.pins[Z.pin];if(U)_5(H,Z,U.p,{elbow:E,endQ:U.q});else aQ(H,Z.root,Z.mid,E);break}}H.fk()}fkDrag($,J,M,Q){let H=$.handle.joint;if(H===void 0)return;let k=this.sel().body;k.fk();let K=T6.set(0,1,0).applyQuaternion(this.cam.quaternion).clone(),w=r8.set(1,0,0).applyQuaternion(this.cam.quaternion).clone(),W=0.012,E;if(Q){let R=new A().copy(k.rig.dir[H]).applyQuaternion(k.wq[H]).normalize();E=new m0().setFromAxisAngle(R,J*W)}else E=new m0().setFromAxisAngle(K,J*W).multiply(new m0().setFromAxisAngle(w,M*W));tQ(k,H,E),u8(k)}onKey=($)=>{this.handleKey($)};handleKey($){let J=$.target;if(J&&(J.tagName==="INPUT"||J.tagName==="SELECT"||J.tagName==="TEXTAREA")&&!($.ctrlKey||$.metaKey))return!1;let M=$.ctrlKey||$.metaKey,Q=$.key.toLowerCase(),H=!0;if(M&&Q==="z")if($.shiftKey)this.redo();else this.undo();else if(M&&Q==="y")this.redo();else if(M&&Q==="c")this.copyPose();else if(M&&Q==="v")this.pastePose();else if(!M&&Q==="m")this.mirror();else if(!M&&Q==="r")this.reset();else if(!M&&Q==="f")this.frameFigures(),this.changed();else if(!M&&Q==="g")this.setShowGrid(!this.showGrid);else if(!M&&Q==="x")this.setMode(this.mode==="ik"?"fk":"ik");else if(!M&&/^[1-4]$/.test(Q))this.selectIndex(Number(Q)-1);else if(!M&&(Q==="delete"||Q==="backspace"))this.removePerson();else H=!1;if(H)$.preventDefault();return H}exportCamera($,J){this.updateCamera();let M=new L1(this.view.fov,$/J,0.05,120);return M.position.copy(this.cam.position),M.quaternion.copy(this.cam.quaternion),M.updateMatrixWorld(),M}getKeypoints2D($={}){let[J,M]=[$.width??this.out[0],$.height??this.out[1]],Q=this.exportCamera(J,M);return this.model.persons.map((H)=>KJ(H.body,Q,H.id))}exportImageData($,J={}){let M=J.width??this.out[0],Q=J.height??this.out[1],H=this.exportCamera(M,Q);if($==="skeleton"){let K=this.model.persons.map((W)=>KJ(W.body,H,W.id)),w=wJ(K,M,Q,{hands:J.hands??!0,face:J.face??!0,scale:J.thumb?M/this.out[0]:1});return new ImageData(w.data,M,Q)}if(!this.gpu)throw Error("WebGL2 is required for this map");this.gpu.sync(this.model.persons.map((K)=>({id:K.id,body:K.body,color:K.color})));let k=this.gpu.renderMap($,H,M,Q,{regionMode:J.regionMode});return this.dirty=!0,k}async exportMap($,J={}){return(await this.exportResult($,J)).blob}async exportResult($,J={}){let M=this.exportImageData($,J);return{kind:$,width:M.width,height:M.height,imageData:M,blob:await UH(M)}}async exportAll($={}){let J={};for(let M of a8)J[M]=await this.exportResult(M,$);return J}exportAllImageData($={}){let J={};for(let M of a8)J[M]=this.exportImageData(M,$);return J}getPose(){let $=this.model.getPose();return $.cam={az:Math.round(this.view.az*180/Math.PI*100)/100,el:Math.round(this.view.el*180/Math.PI*100)/100,d:Math.round(this.view.dist*1000)/1000,t:[this.view.target.x,this.view.target.y,this.view.target.z].map((J)=>Math.round(J*1000)/1000),fov:this.view.fov},$.out=[...this.out],$}setPose($){let J=typeof $==="string"?A6($):$;if(this.model.push(),this.model.setPose(J),J.cam)this.view.az=J.cam.az*Math.PI/180,this.view.el=J.cam.el*Math.PI/180,this.view.dist=J.cam.d,this.view.target.set(J.cam.t[0],J.cam.t[1],J.cam.t[2]),this.view.fov=J.cam.fov;if(J.out)this.out=[J.out[0],J.out[1]];this.selJoint=null,this.changed(),this.emit("select",this.model.selected)}getPoseString(){return kJ(this.getPose())}setPoseString($){this.setPose(A6($))}importKeypoints2D($){let{importKeypoints:J}=QZ,M=$.map((Q)=>Array.isArray(Q)?{x:Q[0],y:Q[1],v:Q[2]??1}:Q);this.model.push(),J(this.sel().body,M,this.exportCamera(this.out[0],this.out[1]),this.out),this.changed()}destroy(){if(this.destroyed)return;this.destroyed=!0,cancelAnimationFrame(this.raf),this.ro?.disconnect(),this.root.removeEventListener("keydown",this.onKey),this.gpu?.dispose(),this.gpu=null,this.root.remove(),this.listeners.clear(),this.pointers.clear()}static sanitizeProps=z6;static maxPeople=o8;static presets=c8;static views=t$;static sizes=a$}function UH($){if(typeof OffscreenCanvas<"u"){let M=new OffscreenCanvas($.width,$.height);return M.getContext("2d").putImageData($,0,0),M.convertToBlob({type:"image/png"})}let J=document.createElement("canvas");return J.width=$.width,J.height=$.height,J.getContext("2d").putImageData($,0,0),new Promise((M,Q)=>J.toBlob((H)=>H?M(H):Q(Error("PNG encode failed")),"image/png"))}var QZ={importKeypoints:($,J,M,Q)=>{}};var q1=($,J,M,Q,H,k={})=>({id:$,phrase:J,limb:{t:M,hand:Q,pole:H,...k}}),YH=[q1("down","arm relaxed at the side",[1,-0.45,0.05],"relaxed"),q1("hip","hand on hip",[0.72,0.1,0.5],"relaxed",[1,0,-0.3],{wrist:[-10,0,0],twist:-10}),q1("pocket","hand in pocket",[0.8,-0.15,0.35],"relaxed",[0.6,-0.4,-0.6]),q1("raised","arm raised overhead",[1.3,4.5,0.2],"open",[0.4,-0.5,-1]),q1("reach-up","reaching up high",[-0.45,4.65,0.5],"open",[-0.3,-0.4,-1]),q1("wave","arm raised waving",[1.3,3,0.3],"open",[0.6,-0.8,-0.5]),q1("out-side","arm stretched out to the side",[3.2,1.9,0],"open"),q1("diag-down","arm held out low to the side",[2.6,0.15,0],"open",void 0,{twist:-20}),q1("forward","arm stretched forward",[0.78,1.3,2.3],"open",[0.8,-1,-0.5]),q1("point","pointing forward",[0.9,1.7,2.4],"point",[0.8,-1,-0.5]),q1("chest","hand on chest",[0.3,1.45,0.65],"relaxed",[0.9,-0.5,-0.5]),q1("chin","hand raised to the chin",[0.3,2.4,0.7],"relaxed",[0.9,-0.6,-0.4]),q1("head","hand behind the head",[0.55,2.8,-0.15],"relaxed",[1,0.2,-0.2]),q1("salute","saluting",[0.45,2.55,0.45],"open",[1,-0.3,-0.3]),q1("fist","fist raised",[0.7,2.6,1],"fist",[0.5,-1,-0.2]),q1("behind","hand behind the back",[0.4,0.2,-0.6],"relaxed",[0.9,-0.5,0.2]),q1("cross","arm folded across the body",[-0.15,1.15,0.75],"relaxed",[0.2,-1,-0.2]),q1("guard","fist up in guard",[0.4,1.7,1],"fist",[0.9,-1,-0.2]),q1("hold","holding something in front",[0.3,1.1,1.3],"grip",[0.8,-1,-0.3])],RJ=[{id:"stand",phrase:"standing",ground:!0,free:!0},{id:"relaxed",phrase:"standing relaxed, weight on one leg",ground:!0,free:!0},{id:"walk",phrase:"walking mid stride",ground:!0,free:!0},{id:"run",phrase:"running",ground:!0,free:!1},{id:"sit on floor",phrase:"sitting on the floor",ground:!1,free:!0},{id:"sit on chair",phrase:"sitting on a chair",ground:!1,free:!0},{id:"kneel",phrase:"kneeling on one knee",ground:!1,free:!0},{id:"crouch",phrase:"crouching",ground:!1,free:!0},{id:"jump",phrase:"jumping in the air",ground:!1,free:!0},{id:"fighting stance",phrase:"in a fighting stance",ground:!0,free:!1},{id:"sword two-hand hold",phrase:"gripping a two-handed weapon",ground:!0,free:!1},{id:"casting a spell with one arm extended",phrase:"casting a spell",ground:!0,free:!1}];function XH($){let J=$>>>0;return()=>{J=J+1831565813>>>0;let M=J;return M=Math.imul(M^M>>>15,M|1),M^=M+Math.imul(M^M>>>7,M|61),((M^M>>>14)>>>0)/4294967296}}var ZJ=($,J)=>J[Math.floor($()*J.length)],p1=($,J,M)=>J+($()*2-1)*M,NH=($)=>({...$,t:[-$.t[0],$.t[1],$.t[2]],pole:$.pole?[-$.pole[0],$.pole[1],$.pole[2]]:void 0});function UJ($,J){let M=XH($*7919+17),Q=J?RJ.find((G)=>G.id===J):ZJ(M,RJ),H=C6[Q.id],k=JSON.parse(JSON.stringify(H)),K=[Q.phrase],w=[Q.id];if(Q.free){let G=ZJ(M,YH),q=M()<0.3,Y=q?G:ZJ(M,YH),N={...G.limb,t:[...G.limb.t]},V=q?NH(N):NH({...Y.limb,t:[...Y.limb.t]});for(let D of[N,V])D.t=[p1(M,D.t[0],0.12),p1(M,D.t[1],0.2),p1(M,D.t[2],0.12)];if(k.armL=N,k.armR=V,q){let D=G.phrase;K.push(/^arm /.test(D)?D.replace(/^arm/,"both arms"):/^(hand|fist) /.test(D)?D.replace(/^(hand|fist)/,"both $1s"):`${D} with both arms`)}else if(G.id!=="down"||Y.id!=="down")K.push(`left ${G.phrase}`,`right ${Y.phrase}`);w.push(G.id,Y.id)}let W=k.root={...k.root||{}},E=Math.round(p1(M,W.yaw??0,Q.ground?28:18));W.yaw=E;let R=Math.round(p1(M,0,8));k.spine=[(k.spine?.[0]??0)+R,p1(M,k.spine?.[1]??0,8),p1(M,k.spine?.[2]??0,7)];let Z=Math.round(p1(M,k.head?.[0]??0,10)),U=Math.round(p1(M,k.head?.[2]??0,12)),X=Math.round(p1(M,k.head?.[1]??0,20));if(k.head=[Z,X,U],k.neck=[k.neck?.[0]??0,p1(M,k.neck?.[1]??0,10),k.neck?.[2]??0],U>6)K.push("head tilted to the left");else if(U<-6)K.push("head tilted to the right");if(Z>7)K.push("chin down");else if(Z<-7)K.push("chin up");if(X>12)K.push("looking over the left shoulder");else if(X<-12)K.push("looking over the right shoulder");if(R>5)K.push("leaning forward");else if(R<-5)K.push("leaning back");if(Math.abs(E)>20&&Q.ground)K.push(E>0?"body turned to the left":"body turned to the right");if(Q.ground&&k.legL&&k.legL!==void 0){let G=p1(M,0,0.18),q=k.legL;if(q.t=[q.t[0]+G,q.t[1],p1(M,q.t[2],0.2)],k.legR&&k.legR!=="mirror"){let Y=k.legR;Y.t=[Y.t[0]-G,Y.t[1],p1(M,Y.t[2],0.2)]}if(G>0.1)K.push("feet wide apart")}return{name:K.slice(0,3).join(", "),base:Q.id,description:K.join(", "),tags:w,spec:k,yaw:E}}var YJ=RJ.map(($)=>$.id);var HZ={undo:"M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",redo:"m15 14 5-5-5-5M20 9H10a6 6 0 0 0 0 12h3",mirror:"M12 3v18M8 7l-5 5 5 5zM16 7l5 5-5 5z",reset:"M4 12a8 8 0 1 0 3-6.2M4 4v5h5",copy:"M9 9h11v11H9zM5 15V5h10",paste:"M8 4h8v3H8zM6 5H5v16h14V5h-1M9 13h6M9 17h4",userPlus:"M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M19 8v6M16 11h6",userMinus:"M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 11h6",view:"M3 8h4l2-3h6l2 3h4v11H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",grid:"M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18",shadow:"M3 17c0-2 4-3.5 9-3.5s9 1.5 9 3.5-4 3.5-9 3.5-9-1.5-9-3.5zM12 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",bones:"M4 4h4v4H4zM16 16h4v4h-4zM8 8l8 8",frame:"M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5",depth:"M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4",pin:"M12 17v5M8 3h8l-1 6 3 4H6l3-4z",download:"M12 4v11M7 11l5 5 5-5M5 20h14",export:"M12 15V3M7 8l5-5 5 5M5 21h14",chevron:"m6 9 6 6 6-6"},NJ={mesh:"Mesh",skeleton:"Skeleton",depth:"Depth",region:"Region"},kZ=[["footL","LF","Pin left foot"],["footR","RF","Pin right foot"],["handL","LH","Pin left hand"],["handR","RH","Pin right hand"]],KZ=[{key:"headsTall",label:"Heads tall",step:0.1,fmt:($)=>$.toFixed(1),hint:"7.5 realistic, 9 stylized"},{key:"height",label:"Height",step:0.01,fmt:($)=>`${$.toFixed(2)} m`},{key:"shoulder",label:"Shoulder width",step:0.01,fmt:($)=>`${$.toFixed(2)}x`},{key:"hip",label:"Hip width",step:0.01,fmt:($)=>`${$.toFixed(2)}x`},{key:"limb",label:"Limb length",step:0.01,fmt:($)=>`${$.toFixed(2)}x`},{key:"sex",label:"Build",step:0.05,fmt:($)=>$.toFixed(2),hint:"0 feminine, 0.5 neutral, 1 masculine"}],h6=0;function GH($,J={}){let M=[],Q=!1,H=(_,n,C,o)=>{_.addEventListener(n,C,o),M.push(()=>_.removeEventListener(n,C,o))};if(J.ui===!1){let _=new u5($,J);if(J.onChange)M.push(_.on("change",()=>J.onChange(JSON.stringify(_.getPose()))));return{studio:_,el:$,getPose:()=>_.getPose(),setPose:(n)=>_.setPose(n),exportAll:(n)=>_.exportAll(n),exportMap:(n,C)=>_.exportMap(n,C),destroy(){if(Q)return;Q=!0,M.forEach((n)=>n()),_.destroy()}}}let k=(_,n={},...C)=>{let o=document.createElement(_);for(let[J0,W0]of Object.entries(n)){if(W0===void 0||W0===!1||W0===null)continue;if(J0==="class")o.className=W0;else if(J0==="on")for(let[M0,r]of Object.entries(W0))H(o,M0,r);else o.setAttribute(J0,W0===!0?"":String(W0))}for(let J0 of C)if(J0)o.append(J0);return o},K=(_)=>{let n=document.createElementNS("http://www.w3.org/2000/svg","svg");n.setAttribute("viewBox","0 0 24 24"),n.setAttribute("aria-hidden","true"),n.setAttribute("class","ps-ico");let C=document.createElementNS("http://www.w3.org/2000/svg","path");return C.setAttribute("d",HZ[_]),n.append(C),n},w=(_,n,C={})=>k("button",{type:"button",class:`ps-btn ${C.cls??""}`,"aria-label":_,title:_,"aria-pressed":C.toggle?"false":void 0,on:{click:n}},C.icon&&K(C.icon),C.text&&k("span",{class:"ps-btn-t"},C.text)),W=(_,n)=>_.setAttribute("aria-pressed",String(n)),E=(_,n,...C)=>k("details",{class:"ps-sec",open:!0,"data-sec":_},k("summary",{class:"ps-sec-h"},k("span",{},n),K("chevron")),k("div",{class:"ps-sec-b"},...C)),R=(_,...n)=>k("div",{class:"ps-grp",role:"group","aria-label":_},...n),Z=k("div",{class:"ps-canvas"}),U=new u5(Z,J),X=U.getState(),G="person",q=!0,Y=!0,N=["ik","fk"].map((_)=>w(_==="ik"?"Inverse kinematics: drag hands and feet":"Forward kinematics: rotate joints",()=>U.setMode(_),{text:_.toUpperCase(),toggle:!0})),V=w("Depth drag: moving a handle changes its distance from the camera",()=>U.setDepthMode(!X.depthMode),{icon:"depth",text:"Depth",toggle:!0}),D=w("Undo (Ctrl+Z)",()=>U.undo(),{icon:"undo"}),P=w("Redo (Ctrl+Shift+Z)",()=>U.redo(),{icon:"redo"}),h=kZ.map(([_,n,C])=>Object.assign(w(C,()=>U.togglePin(_),{icon:"pin",text:n,toggle:!0}),{_k:_})),B=w("Paste pose (Ctrl+V)",()=>U.pastePose(),{icon:"paste"}),S=w("Add person",()=>U.addPerson(),{icon:"userPlus"}),b=w("Remove selected person (Delete)",()=>U.removePerson(),{icon:"userMinus"}),z=w("Toggle floor grid (G)",()=>U.setShowGrid(!X.grid),{icon:"grid",toggle:!0}),O=w("Toggle shadow",()=>U.setShowShadow(!X.shadow),{icon:"shadow",toggle:!0}),f=w("Toggle bone overlay",()=>U.setShowBones(!X.bones),{icon:"bones",toggle:!0}),g=`ps-menu-${++h6}`,p=k("div",{class:"ps-menu",id:g,role:"menu",hidden:!0},...t$.map((_)=>k("button",{type:"button",class:"ps-menu-i",role:"menuitem",on:{click:()=>{U.setCameraView(_),m(),u.focus()}}},_))),u=w("Camera view presets",()=>p.hidden?t():m(),{icon:"view",text:"View"});u.setAttribute("aria-haspopup","menu"),u.setAttribute("aria-controls",g),u.setAttribute("aria-expanded","false");let t=()=>{p.hidden=!1,u.setAttribute("aria-expanded","true")},m=()=>{p.hidden=!0,u.setAttribute("aria-expanded","false")};H(document,"pointerdown",(_)=>{if(!p.hidden&&!p.contains(_.target)&&!u.contains(_.target))m()}),H(p,"keydown",(_)=>{if(_.key==="Escape")m(),u.focus(),_.stopPropagation()});let e=k("div",{class:"ps-toolbar",role:"toolbar","aria-label":"Pose tools"},R("Mode",k("div",{class:"ps-seg"},...N),V),R("History",D,P,w("Mirror pose (M)",()=>U.mirror(),{icon:"mirror"}),w("Reset pose (R)",()=>U.reset(),{icon:"reset"})),R("Pins",...h),R("Pose clipboard",w("Copy pose (Ctrl+C)",()=>U.copyPose(),{icon:"copy"}),B),R("People",S,b),R("Camera",k("div",{class:"ps-menu-wrap"},u,p),w("Frame figures (F)",()=>{U.frameFigures()},{icon:"frame"})),R("Display",z,O,f)),d=k("div",{class:"ps-stage"},Z,e),Q0=k("div",{class:"ps-chips",role:"group","aria-label":"People"}),w0="";H(Q0,"click",(_)=>{let n=_.target.closest("[data-id]");if(n)U.selectPerson(Number(n.dataset.id))});let D0=k("div",{class:"ps-presets"},...c8.map((_)=>k("button",{type:"button",class:"ps-chip ps-preset",title:_,"aria-label":`Preset: ${_}`,"data-n":_},_)));H(D0,"click",(_)=>{let n=_.target.closest("[data-n]");if(n)U.setPreset(n.dataset.n)});let v0="both",l0=["L","R","both"].map((_)=>{return w(_==="both"?"Apply hand shape to both hands":`Apply hand shape to ${_==="L"?"left":"right"} hand`,()=>{v0=_,l0.forEach((C,o)=>W(C,o===["L","R","both"].indexOf(_)))},{text:_==="both"?"Both":_,toggle:!0})});l0.forEach((_,n)=>W(_,n===2));let c=k("div",{class:"ps-presets ps-hands"},...e7.map((_)=>k("button",{type:"button",class:"ps-chip","aria-label":`Hand shape: ${_}`,title:_,on:{click:()=>U.setHandShape(v0,_)}},_))),R0=new Map,G0=(_,n,C,o,J0,W0,M0,r,V0,b0)=>{let s0=k("input",{type:"range",class:"ps-range",id:_,min:C,max:o,step:J0}),i0=k("output",{class:"ps-val",for:_}),O1={input:s0,out:i0,dragging:!1};R0.set(_,O1);let V1=()=>{if(!O1.dragging)return;O1.dragging=!1,window.removeEventListener("pointerup",V1),window.removeEventListener("pointercancel",V1),b0?.()};return M.push(()=>{window.removeEventListener("pointerup",V1),window.removeEventListener("pointercancel",V1)}),H(s0,"pointerdown",()=>{if(O1.dragging)return;O1.dragging=!0,V0?.(),window.addEventListener("pointerup",V1),window.addEventListener("pointercancel",V1)}),H(s0,"input",()=>{let O5=Number(s0.value);i0.textContent=W0(O5),r(O5,O1.dragging)}),{el:k("div",{class:"ps-row"},k("div",{class:"ps-row-h"},k("label",{for:_},n),i0),s0,M0&&k("div",{class:"ps-hint"},M0)),set:(O5)=>{if(!O1.dragging)s0.value=String(O5);i0.textContent=W0(O5)}}},H0=KZ.map((_)=>({r:_,s:G0(`ps-p-${h6}-${_.key}`,_.label,Z8[_.key][0],Z8[_.key][1],_.step,_.fmt,_.hint,(n,C)=>C?U.previewProportions({[_.key]:n}):U.setProportions({[_.key]:n}),()=>U.beginEdit(),()=>U.endEdit())})),E0=G0(`ps-fov-${h6}`,"Field of view",12,90,1,(_)=>`${Math.round(_)} deg`,void 0,(_)=>U.setFov(_)),T0=(_,n)=>`${_}x${n}`,h0=k("select",{class:"ps-select",id:`ps-size-${h6}`,"aria-label":"Output size"},...a$.map(([_,n])=>k("option",{value:T0(_,n)},`${_}x${n}`)));H(h0,"change",()=>{let[_,n]=h0.value.split("x").map(Number);U.setOutputSize(_,n)});let _0=k("select",{class:"ps-select",id:`ps-region-${h6}`,"aria-label":"Region map mode"},k("option",{value:"person"},"Per person"),k("option",{value:"parts"},"Body parts"));H(_0,"change",()=>{G=_0.value,U0()});let T=(_,n,C)=>{let o=k("input",{type:"checkbox",class:"ps-check"});return o.checked=n,H(o,"change",()=>{C(o.checked),U0()}),k("label",{class:"ps-checklab"},o,k("span",{},_))},d0=(_,n,C)=>k("div",{class:"ps-field"},k("label",{for:n},_),C),F0=new Map,x0=k("div",{class:"ps-thumbs"},...a8.map((_)=>{let n=k("canvas",{class:"ps-thumb-cv",role:"img","aria-label":`${NJ[_]} map preview`});return F0.set(_,{cv:n,ctx:n.getContext("2d")}),k("figure",{class:"ps-thumb"},n,k("figcaption",{class:"ps-thumb-c"},k("span",{},NJ[_]),w(`Download ${NJ[_]} map as PNG`,()=>{v(_)},{icon:"download",cls:"ps-btn-sm"})))})),q0=k("span",{class:"ps-status",role:"status","aria-live":"polite"}),n0=0,N0=(_,n=!1)=>{if(q0.textContent=_,q0.classList.toggle("ps-err",n),clearTimeout(n0),_)n0=window.setTimeout(()=>{q0.textContent=""},3500)},z0=k("textarea",{class:"ps-text",rows:5,"aria-label":"Pose JSON",placeholder:"Paste pose JSON or encoded pose string",spellcheck:"false"}),a0=k("div",{class:"ps-error",role:"alert"}),o0=k("div",{class:"ps-paste",hidden:!0},z0,a0,k("div",{class:"ps-paste-a"},w("Apply pose JSON",()=>{let _=z0.value.trim();try{if(!_)throw Error("Nothing to apply");U.setPose(_.startsWith("{")?JSON.parse(_):_),a0.textContent="",o0.hidden=!0,N0("Pose applied")}catch(n){a0.textContent="Invalid pose data: expected pose JSON or an encoded pose string"}},{text:"Apply",cls:"ps-btn-primary"}),w("Cancel",()=>{o0.hidden=!0,a0.textContent=""},{text:"Cancel"}))),M1=async()=>{let _=JSON.stringify(U.getPose());try{await navigator.clipboard.writeText(_),N0("Pose JSON copied")}catch{z0.value=_,o0.hidden=!1,z0.focus(),z0.select(),N0("Select and copy the JSON below")}},I=(_={})=>({regionMode:G,hands:q,face:Y,..._}),F=(_,n)=>{let C=URL.createObjectURL(_),o=k("a",{href:C,download:n});document.body.append(o),o.click(),o.remove(),setTimeout(()=>URL.revokeObjectURL(C),4000)},v=async(_)=>{try{let n=await U.exportMap(_,I()),[C,o]=U.getOutputSize();F(n,`pose-${_}-${C}x${o}.png`)}catch(n){N0(n instanceof Error?n.message:"Export failed",!0)}},i=w("Export all maps",async()=>{i.disabled=!0;try{let _=await U.exportAll(I());if(J.onExport)J.onExport(_);else for(let n of a8)F(_[n].blob,`pose-${n}-${_[n].width}x${_[n].height}.png`);N0("Exported")}catch(_){N0(_ instanceof Error?_.message:"Export failed",!0)}i.disabled=!1},{icon:"export",text:"Export maps",cls:"ps-btn-primary ps-btn-wide"}),$0=k("div",{class:"ps-panel-body"},E("people","People",Q0),E("presets","Presets",D0),E("maps","Maps",x0),E("hands","Hands",R("Hand side",...l0),c),E("props","Proportions",...H0.map((_)=>_.s.el)),E("camera","Camera and output",E0.el,d0("Output size",h0.id,h0),d0("Region map",_0.id,_0),k("div",{class:"ps-checks"},k("span",{class:"ps-lab"},"Skeleton"),T("Hands",q,(_)=>q=_),T("Face",Y,(_)=>Y=_)))),s=k("div",{class:"ps-panel-foot"},o0,k("div",{class:"ps-foot-r"},i,w("Copy pose JSON",()=>{M1()},{icon:"copy",text:"Copy JSON"}),w("Paste pose JSON",()=>{if(o0.hidden=!o0.hidden,!o0.hidden)z0.focus()},{icon:"paste",text:"Paste JSON"})),q0),O0=k("aside",{class:"ps-panel","aria-label":"Pose settings"},$0,s),Z0=k("div",{class:"ps-app"},d,O0),P0=k("div",{class:"ps-root"},Z0);$.append(P0),H(P0,"keydown",(_)=>{if(_.defaultPrevented)return;let n=_.target;if(n.tagName==="TEXTAREA"||n.tagName==="INPUT"&&!["range","checkbox"].includes(n.type))return;if((_.key==="Delete"||_.key==="Backspace")&&n.tagName==="BUTTON")return;U.handleKey(_)});let S0=0,k0="",U0=()=>{if(S0||Q)return;S0=window.setTimeout(()=>{S0=0,C0()},250)},C0=()=>{if(Q)return;let[_,n]=X.size,C=200/Math.max(_,n),o=Math.max(16,Math.round(_*C)),J0=Math.max(16,Math.round(n*C)),W0=`${o}x${J0}`;for(let[M0,r]of F0){if(W0!==k0)r.cv.width=o,r.cv.height=J0,r.cv.style.aspectRatio=`${o} / ${J0}`;try{r.ctx.putImageData(U.exportImageData(M0,{width:o,height:J0,thumb:!0,regionMode:G,hands:q,face:Y}),0,0)}catch{r.ctx.clearRect(0,0,o,J0)}}k0=W0},I0=(_)=>{X=_,N.forEach((o,J0)=>W(o,_.mode===(J0===0?"ik":"fk"))),W(V,_.depthMode),W(z,_.grid),W(O,_.shadow),W(f,_.bones),D.disabled=!_.canUndo,P.disabled=!_.canRedo,B.disabled=!_.canPaste,S.disabled=_.people.length>=u5.maxPeople,b.disabled=_.people.length<=1;for(let o of h)W(o,_.pins[o._k]);let n=_.people.map((o)=>`${o.id}:${o.color}`).join(",")+`|${_.selected}`;if(n!==w0)w0=n,Q0.replaceChildren(..._.people.map((o,J0)=>{let W0=R8[o.color%R8.length];return k("button",{type:"button",class:"ps-chip ps-person","data-id":o.id,"aria-label":`Select figure ${J0+1}`,title:`Figure ${J0+1} (key ${J0+1})`,"aria-pressed":String(o.id===_.selected)},k("i",{class:"ps-sw",style:`background:rgb(${W0[0]},${W0[1]},${W0[2]})`}),String(J0+1))}));for(let{r:o,s:J0}of H0){let W0=_.props?.[o.key];if(typeof W0==="number")J0.set(W0)}E0.set(_.fov);let C=T0(_.size[0],_.size[1]);if(![...h0.options].some((o)=>o.value===C))h0.append(k("option",{value:C},`${_.size[0]}x${_.size[1]}`));h0.value=C,U0()};return M.push(U.on("state",(_)=>I0(_))),M.push(U.on("change",()=>{if(U0(),J.onChange)J.onChange(JSON.stringify(U.getPose()))})),M.push(U.on("select",()=>U0())),I0(X),{studio:U,el:P0,getPose:()=>U.getPose(),setPose:(_)=>U.setPose(_),exportAll:(_)=>U.exportAll(I(_)),exportMap:(_,n)=>U.exportMap(_,I(n)),destroy(){if(Q)return;Q=!0,clearTimeout(S0),clearTimeout(n0),M.forEach((_)=>_()),M.length=0,U.destroy(),P0.remove()}}}var wZ={mount($,J={}){return GH($,J)},PoseStudio:u5,sampleSpec:UJ,BODY_TYPES:i8,BASE_IDS:YJ,version:"1.0.0"};window.PoseStudioApp=wZ;})();
