import {clamp,getParameterOptions} from './state.mjs';

// Continuous settings retain the v1 signed interpolation. Discrete strength
// scales the chance of a change; its sign selects forward/backward option order.
export function randomParameterValue(state,path,current,strength,random=Math.random){
 strength=clamp(strength,-1,1);if(!strength)return current;
 const options=typeof current==='boolean'?[false,true]:getParameterOptions(path,state);
 if(options){
  if(options.length<2||random()>=Math.abs(strength))return current;
  const from=Math.max(0,options.indexOf(current)),step=1+Math.floor(clamp(random(),0,.999999)*(options.length-1));
  return options[(from+(strength>0?step:-step)+options.length)%options.length];
 }
 return typeof current==='number'?clamp(current+(random()-current)*strength):current;
}
