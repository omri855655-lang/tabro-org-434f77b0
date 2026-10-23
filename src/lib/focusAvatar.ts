export const AVATAR_SKINS = [0xe9b38d,0xc08b65,0x875b43,0xf1c6a3];
export const AVATAR_HAIR = [0x49362d,0x292d31,0xb68a50,0xb6aba0];
export const AVATAR_PANTS = [0x39484d,0x294b70,0x776550,0x60645c];
export type AvatarDesign = {shirt:number;skin:number;hair:number;cut:number;accessory:number;pants:number};
export function normalizeAvatarStyle(value:unknown):number {
  return typeof value==='number'&&Number.isInteger(value)&&value>=0&&value<4616?value:0;
}
export function decodeAvatar(value:unknown):AvatarDesign {
  const style=normalizeAvatarStyle(value);
  if(style<8)return {shirt:style,skin:style%4,hair:style%3?0:1,cut:0,accessory:0,pants:0};
  let bits=style-8;
  const take=(base:number)=>{const digit=bits%base;bits=Math.floor(bits/base);return digit;};
  return {shirt:take(8),skin:take(4),hair:take(4),cut:take(3),accessory:take(3),pants:take(4)};
}
export function encodeAvatar(design:AvatarDesign):number {
  const fields:[number,number][]=[[design.pants,4],[design.accessory,3],[design.cut,3],[design.hair,4],[design.skin,4],[design.shirt,8]];
  return 8+fields.reduce((value,[digit,base])=>value*base+Math.max(0,Math.min(base-1,Math.trunc(digit)||0)),0);
}
export const avatarEditorCopy={
  he:['עיצוב אישי','גוון עור','צבע שיער','תסרוקת','אביזר','מכנסיים','קצר','ארוך','ללא שיער','אוזניות','משקפיים','ללא אביזר'],
  en:['Customize','Skin tone','Hair color','Hairstyle','Accessory','Trousers','Short','Long','No hair','Headphones','Glasses','No accessory'],
  es:['Personalizar','Piel','Color de pelo','Peinado','Accesorio','Pantalones','Corto','Largo','Sin pelo','Auriculares','Gafas','Sin accesorio'],
  zh:['自定义','肤色','发色','发型','配饰','裤子','短发','长发','无发','耳机','眼镜','无配饰'],
  ar:['تخصيص','لون البشرة','لون الشعر','تسريحة','إكسسوار','بنطال','قصير','طويل','بدون شعر','سماعات','نظارات','بدون إكسسوار'],
  ru:['Настройка','Тон кожи','Цвет волос','Причёска','Аксессуар','Брюки','Короткие','Длинные','Без волос','Наушники','Очки','Без аксессуара'],
};
