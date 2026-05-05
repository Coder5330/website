import pygame as pg
import moderngl as mgl
from item_icons import get_item_icons

class Textures:
    def __init__(self, app):
        self.app = app
        self.ctx = app.ctx
        self.item_texture_cache = {}
        # load textures
        self.texture_0 = self.load('frame.png')
        self.texture_1 = self.load('water.png')
        self.texture_array_0 = self.load('tex_array_0.png', is_tex_array=True)
        self.texture_array_1 = self.load_ore_array('tex_array_1.png')
        self.texture_crack = self.load_crack_array()
        self.texture_crafting_table = self.load('crafting_table.png')
        # assign texture units
        self.texture_0.use(location=0)
        self.texture_array_0.use(location=1)
        self.texture_1.use(location=2)
        self.texture_crack.use(location=3)
        self.texture_array_1.use(location=4)
        self.texture_crafting_table.use(location=6)

    def load_crack_array(self):
        images = []
        w, h = 16, 16
        for i in range(10):
            img = pg.image.load(f'assets/crack_{i}.png').convert_alpha()
            img = pg.transform.scale(img, (w, h))
            img = pg.transform.flip(img, True, False)
            images.append(pg.image.tostring(img, 'RGBA'))
        texture = self.ctx.texture_array(
            size=(w, h, 10),
            components=4,
            data=b''.join(images)
        )
        texture.filter = (mgl.NEAREST, mgl.NEAREST)
        return texture

    def load_ore_array(self, file_name):
        sheet = pg.image.load(f'assets/{file_name}').convert_alpha()
        cols, rows = 4, 2
        tiles = []

        for row in range(rows):
            top = round(row * sheet.get_height() / rows)
            bottom = round((row + 1) * sheet.get_height() / rows)
            for col in range(cols):
                left = round(col * sheet.get_width() / cols)
                right = round((col + 1) * sheet.get_width() / cols)
                tile = sheet.subsurface((left, top, right - left, bottom - top))
                tile = pg.transform.flip(tile, True, False)
                tiles.append(tile)

        tile_w, tile_h = tiles[0].get_size()
        layers = []
        ore_indices = (0, 1, 2, 3, 5, 7)  # coal, iron, gold, diamond, redstone, copper

        for index in ore_indices:
            layer = pg.Surface((tile_w * 3, tile_h), pg.SRCALPHA)
            for face in range(3):
                layer.blit(tiles[index], (face * tile_w, 0))
            layers.append(pg.image.tostring(layer, 'RGBA'))

        texture = self.ctx.texture_array(
            size=(tile_w * 3, tile_h, len(layers)),
            components=4,
            data=b''.join(layers)
        )
        texture.anisotropy = 32.0
        texture.build_mipmaps()
        texture.filter = (mgl.NEAREST, mgl.NEAREST)
        return texture

    def get_item_texture(self, item_id, size=32):
        key = (item_id, size)
        if key in self.item_texture_cache:
            return self.item_texture_cache[key]

        surface = get_item_icons(size).get(item_id)
        if surface is None:
            return None

        texture = self.ctx.texture(
            size=surface.get_size(),
            components=4,
            data=pg.image.tostring(surface, 'RGBA', False)
        )
        texture.filter = (mgl.NEAREST, mgl.NEAREST)
        self.item_texture_cache[key] = texture
        return texture

    def load(self, file_name, is_tex_array=False):
        texture = pg.image.load(f'assets/{file_name}')
        texture = pg.transform.flip(texture, flip_x=True, flip_y=False)
        if is_tex_array:
            num_layers = 3 * texture.get_height() // texture.get_width()
            texture = self.app.ctx.texture_array(
                size=(texture.get_width(), texture.get_height() // num_layers, num_layers),
                components=4,
                data=pg.image.tostring(texture, 'RGBA')
            )
        else:
            texture = self.ctx.texture(
                size=texture.get_size(),
                components=4,
                data=pg.image.tostring(texture, 'RGBA', False)
            )
        texture.anisotropy = 32.0
        texture.build_mipmaps()
        texture.filter = (mgl.NEAREST, mgl.NEAREST)
        return texture