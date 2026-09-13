"use client";
import {useEffect} from 'react';

export default function ContactBridge(){
 useEffect(()=>{
  if(document.getElementById('rv-contact-loader'))return;
  const style=document.createElement('link');style.rel='stylesheet';style.href='/abogados/contact-widget.css';document.head.appendChild(style);
  const files=['configuration.js','measurement.js','native-bridge.js','contact.js'];
  function next(index:number){
   if(index>=files.length)return;
   const script=document.createElement('script');script.src='/abogados/'+files[index];script.async=false;
   if(index===0)script.id='rv-contact-loader';
   script.onload=()=>next(index+1);document.body.appendChild(script);
  }
  next(0);
 },[]);
 return null;
}
