'use client';
import { useEffect, useState } from 'react';

export default function ScatterBg({ count = 16 }) {
  const [images, setImages] = useState([]);
  useEffect(()=>{
    setImages(Array.from({length: count}).map((_,i)=>({
      id:i,
      seed: 3000+i,
      top: Math.floor(Math.random()*85),
      left: Math.floor(Math.random()*85),
      w: 100+Math.floor(Math.random()*200),
      h: 100+Math.floor(Math.random()*200),
      rot: Math.floor(Math.random()*70)-35
    })));
  },[count]);

  useEffect(()=>{
    const elems = Array.from(document.querySelectorAll('.scatter'));
    if(!elems.length) return;
    const states = elems.map(el=>{
      const left = parseFloat(el.style.left) || Math.random()*70 + 5;
      const top = parseFloat(el.style.top) || Math.random()*70 + 5;
      return { el, x:left, y:top, vx:(Math.random()-0.5)*0.2, vy:(Math.random()-0.5)*0.2 };
    });
    let raf;
    const tick = ()=>{
      states.forEach(s=>{
        s.x += s.vx;
        s.y += s.vy;
        if(s.x <= 2 || s.x >= 96) s.vx *= -1;
        if(s.y <= 2 || s.y >= 96) s.vy *= -1;
        s.el.style.left = s.x + '%';
        s.el.style.top = s.y + '%';
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return ()=>cancelAnimationFrame(raf);
  },[]);

  return (
    <div className="bg-scatter">
      {images.map(img=>(
        <div key={img.id} className="scatter" style={{
          top:`${img.top}%`,
          left:`${img.left}%`,
          width:img.w,
          height:img.h,
          backgroundImage:`url(https://picsum.photos/seed/${img.seed}/400/400)`
        }}/>
      ))}
    </div>
  );
}
