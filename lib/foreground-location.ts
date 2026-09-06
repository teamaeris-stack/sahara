/** One foreground GPS request. Capacitor plugin is used only in the installed Android app. */
export async function foregroundLocation(): Promise<{lat:number;lng:number}> {
  type NativePosition={coords:{latitude:number;longitude:number}};
  type GeoPlugin={requestPermissions:()=>Promise<unknown>;getCurrentPosition:(options:Record<string,unknown>)=>Promise<NativePosition>};
  const capacitor=(window as unknown as {Capacitor?:{isNativePlatform?:()=>boolean;registerPlugin?:(name:string)=>GeoPlugin}}).Capacitor;
  if(capacitor?.isNativePlatform?.()&&capacitor.registerPlugin){
    const geo=capacitor.registerPlugin('Geolocation');
    await geo.requestPermissions();
    const result=await geo.getCurrentPosition({enableHighAccuracy:true,timeout:10000,maximumAge:0});
    return {lat:result.coords.latitude,lng:result.coords.longitude};
  }
  if(!navigator.geolocation)throw new Error('Geolocation unavailable');
  return new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(p=>resolve({lat:p.coords.latitude,lng:p.coords.longitude}),reject,{enableHighAccuracy:true,timeout:10000,maximumAge:0}));
}
