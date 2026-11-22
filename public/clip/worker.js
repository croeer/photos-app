const groups = [
  [
    ["tasse", "a ceramic mug with a handle"], ["becher", "a ceramic drinking cup without a handle"],
    ["schale", "a ceramic bowl"], ["teller", "a flat ceramic dinner plate"],
    ["vase", "a ceramic flower vase"], ["krug", "a ceramic pitcher with a pouring spout"],
    ["übertopf", "a ceramic plant pot"], [null, "a collection of different objects or another ceramic shape"],
  ],
  [
    ["blau", "pottery with a blue glaze"], ["grün", "pottery with a green glaze"],
    ["weiß", "a white ceramic piece"], ["beige", "beige or cream pottery"], ["braun", "brown pottery"],
    ["schwarz", "black pottery"], ["rosa", "pink pottery"], ["gelb", "yellow pottery"],
    [null, "pottery in mixed colors or a different color"],
  ],
  [
    ["gesprenkelt", "pottery covered in small speckles"], ["gestreift", "pottery with painted stripes"],
    ["gepunktet", "pottery decorated with polka dots"], ["geblümt", "pottery with a floral pattern"],
    ["einfarbig", "plain solid-colored pottery without a pattern"], [null, "pottery with another surface pattern"],
  ],
  [
    ["dackel", "pottery decorated with a picture of a long-bodied, short-legged dachshund dog"],
    ["lebkuchenmann", "pottery decorated with a gingerbread man cookie with icing eyes and buttons"],
    ["weihnachtsbaum", "pottery decorated with a Christmas tree with ornaments on its evergreen branches"],
    ["weihnachten", "pottery with festive Christmas imagery such as holly berries, candy canes or wrapped presents"],
    [null, "pottery with a different decorative motif or a plain undecorated surface"],
  ],
];
let loaded;

// The standalone trial serves its pinned assets locally. The studio fetches
// the same versions on first use and caches model files in the browser.
const runtimeVersion = "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/dist/";
const modelRevision = "d15189d7028b43f1d3e65039190477f6af591c2a";

async function load(studio) {
  const base = studio ? runtimeVersion : "/runtime/";
  const { env, RawImage, AutoTokenizer, AutoProcessor, CLIPTextModelWithProjection,
    CLIPVisionModelWithProjection } = await import(base + "transformers.min.js");
  env.allowRemoteModels = studio;
  env.allowLocalModels = !studio;
  env.localModelPath = "/models/";
  env.backends.onnx.wasm.wasmPaths = base;
  env.backends.onnx.wasm.numThreads = 1;
  env.backends.onnx.wasm.proxy = false;
  const model = studio ? "Xenova/clip-vit-base-patch32" : "clip";
  const options = studio ? { revision: modelRevision } : {};

  // Each loader sets its own ONNX filename on its options object.
  const [tokenizer, processor, textModel, visionModel] = await Promise.all([
    AutoTokenizer.from_pretrained(model, { ...options }), AutoProcessor.from_pretrained(model, { ...options }),
    CLIPTextModelWithProjection.from_pretrained(model, { ...options }), CLIPVisionModelWithProjection.from_pretrained(model, { ...options }),
  ]);
  const prompts = groups.flat().map(([, text]) => "A photo of " + text + ".");
  const tokens = tokenizer(prompts, { padding: true, truncation: true });
  const { text_embeds } = await textModel(tokens);
  const vectors = text_embeds.normalize(2, -1).tolist();
  await textModel.dispose();
  return { processor, visionModel, vectors, RawImage };
}

self.onmessage = async ({ data }) => {
  try {
    if (data.init) {
      loaded = await load(data.studio === true);
      self.postMessage({ ready: true });
      return;
    }
    const image = new loaded.RawImage(new Uint8ClampedArray(data.buffer), data.width, data.height, 4);
    const { pixel_values } = await loaded.processor(image);
    const { image_embeds } = await loaded.visionModel({ pixel_values });
    const vector = image_embeds.normalize(2, -1).data;
    let index = 0;
    const tags = [];
    for (const group of groups) {
      const ranked = group.map(([tag]) => {
        const text = loaded.vectors[index++];
        const score = text.reduce((sum, value, i) => sum + value * vector[i], 0);
        return { tag, score };
      }).sort((a, b) => b.score - a.score);
      // A trial heuristic for near ties, not a calibrated confidence score.
      if (ranked[0].tag && ranked[0].score - ranked[1].score >= 0.006) tags.push(ranked[0].tag);
    }
    self.postMessage({ tags });
  } catch (error) {
    self.postMessage({ error: error.message || String(error) });
  }
};
