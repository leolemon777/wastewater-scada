import * as THREE from 'three';

/**
 * 共享 CanvasTexture 缓存（SPEC-PLAN 16.2 第 7 项 / WP6.5）。
 * 同 key 的程序化纹理全场景只创建一次（模块级），组件实例复用；
 * 生命周期为应用级 —— 不随组件卸载 dispose，避免共享纹理被单实例销毁。
 * dispose 语义验证：视图/组件往返后 renderer.info.memory.textures 不增长。
 */
const cache = new Map<string, THREE.CanvasTexture>();

export function sharedCanvasTexture(
  key: string,
  factory: () => THREE.CanvasTexture,
): THREE.CanvasTexture {
  let texture = cache.get(key);
  if (!texture) {
    texture = factory();
    cache.set(key, texture);
  }
  return texture;
}

/** 测试/热更新辅助：清空共享缓存并 dispose 全部纹理。 */
export function disposeSharedCanvasTextures(): void {
  for (const texture of cache.values()) {
    texture.dispose();
  }
  cache.clear();
}
