"use client";
import {useEffect} from 'react';

export default function ContactBridge(){
 useEffect(()=>{
  if(document.getElementById('rv-contact-loader'))return;
  const files=['configuration.js','measurement.js','native-bridge.js','contact.js'];
  let versions:Record<string,string>={};
  function next(index:number){
   if(index>=files.length)return;
   const script=document.createElement('script');script.src='/abogados/'+files[index]+'?v='+(versions[files[index]]||'native-20260913');script.async=false;
   if(index===0)script.id='rv-contact-loader';
   script.onload=()=>next(index+1);document.body.appendChild(script);
  }
  fetch('/abogados/asset-versions.json',{cache:'no-store'}).then(r=>r.json()).then(value=>{
   if(value&&typeof value==='object'&&!Array.isArray(value))for(const [key,hash] of Object.entries(value)){if([...files,'contact-widget.css','ga4.js'].includes(key)&&typeof hash==='string'&&/^[a-f0-9]{16}$/.test(hash))versions[key]=hash;}
   (window as Window & {RedVitaliaAssetVersions?:Record<string,string>}).RedVitaliaAssetVersions=versions;
  }).catch(()=>{}).finally(()=>{
   const style=document.createElement('link');style.rel='stylesheet';style.href='/abogados/contact-widget.css?v='+(versions['contact-widget.css']||'native-20260913');document.head.appendChild(style);next(0);
  });
 },[]);
 return null;
}
