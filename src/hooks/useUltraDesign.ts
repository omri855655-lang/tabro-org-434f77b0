import {useState} from 'react';
import {safeLocalStorage} from '@/lib/safeLocalStorage';

export function useUltraDesign(scope:string) {
  const key=`tabro-${scope}-style`;
  const [ultra,setValue]=useState(()=>safeLocalStorage.getString(key)==='ultra');
  const setUltra=(value:boolean)=>{setValue(value);safeLocalStorage.setString(key,value?'ultra':'standard');};
  return {ultra,setUltra};
}
