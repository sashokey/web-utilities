const assert = require("node:assert/strict");
const { createHash, webcrypto } = require("node:crypto");
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const { runInNewContext } = require("node:vm");

const root = join(__dirname, "..");

function readPage(relativePath) {
  const path = join(root, relativePath);
  assert.ok(existsSync(path), `${relativePath} is missing`);
  return readFileSync(path, "utf8");
}

function readInlineBlock(html, tag) {
  const matches = [...html.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))];
  assert.equal(matches.length, 1, `expected one inline ${tag}`);
  return matches[0][1];
}

test("the standalone generator permits its inline script and stylesheet", () => {
  const html = readPage("password-generator/index.html");
  const csp = html.match(/http-equiv="Content-Security-Policy"\s+content="([^"]+)"/)?.[1];
  assert.ok(csp, "the generator needs a Content Security Policy");
  for (const tag of ["script", "style"]) {
    const digest = createHash("sha256").update(readInlineBlock(html, tag)).digest("base64");
    assert.ok(csp.includes(`${tag}-src 'sha256-${digest}'`), `${tag} hash must match`);
  }
  assert.ok(csp.includes("connect-src 'none'"));
});

test("the standalone generator has no footer or external links", () => {
  const html = readPage("password-generator/index.html");
  const links = [...html.matchAll(/<a\b[^>]*\bhref=(["'])(https?:\/\/[^"']+)\1/gi)];
  assert.equal(links.length, 0);
  assert.equal(/<footer\b/i.test(html), false);
});

test("the generator produces passwords with the requested length and groups", () => {
  const html = readPage("password-generator/index.html");
  const module = { exports: {} };
  runInNewContext(readInlineBlock(html, "script"), { module });
  const {
    LEXICON, SYMBOLS, CryptoRandom, PhrasePlanner, PassphrasePolicy,
    PassphraseGenerator, EntropyEstimator,
  } = module.exports;
  const generator = new PassphraseGenerator(
    new CryptoRandom(webcrypto), new PhrasePlanner(LEXICON), new PassphrasePolicy(), SYMBOLS,
  );
  const estimator = new EntropyEstimator();
  for (const style of ["story", "random", "characters"]) {
    const result = generator.generate({
      style, vocabulary: "expanded", separator: "-", length: 16,
      capitalize: true, includeNumber: true, includeSymbol: true,
    });
    assert.equal(result.value.length, 16);
    assert.ok(result.combinations > 0n);
    assert.ok(Number.isFinite(estimator.estimate(result).bits));
    for (const group of [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/]) {
      assert.ok(group.test(result.value), `${style} must include ${group}`);
    }
  }
});

test("every generator mode accepts 8 to 64 characters", () => {
  const html = readPage("password-generator/index.html");
  const module = { exports: {} };
  runInNewContext(readInlineBlock(html, "script"), { module });
  const { LEXICON, SYMBOLS, CryptoRandom, PhrasePlanner, PassphrasePolicy, PassphraseGenerator } = module.exports;
  const policy = new PassphrasePolicy();
  const generator = new PassphraseGenerator(new CryptoRandom(webcrypto), new PhrasePlanner(LEXICON), policy, SYMBOLS);
  for (const style of ["story", "random", "characters"]) {
    for (const vocabulary of ["everyday", "expanded"]) {
      for (const flags of [0, 7]) {
        const options = {
          style, vocabulary, separator: "-",
          capitalize: Boolean(flags & 1),
          includeNumber: Boolean(flags & 2),
          includeSymbol: Boolean(flags & 4),
        };
        for (const length of [8, 64]) {
          assert.equal(generator.generate({ ...options, length }).value.length, length);
        }
        for (const length of [7, 65]) {
          assert.throws(() => policy.validate({ ...options, length }), /from 8 to 64/);
        }
      }
    }
  }
});

test("story mode can form a sentence at the default length with all groups", () => {
  const html = readPage("password-generator/index.html");
  const module = { exports: {} };
  runInNewContext(readInlineBlock(html, "script"), { module });
  const { LEXICON, SYMBOLS, CryptoRandom, PhrasePlanner, PassphrasePolicy, PassphraseGenerator } = module.exports;
  const generator = new PassphraseGenerator(new CryptoRandom(webcrypto), new PhrasePlanner(LEXICON), new PassphrasePolicy(), SYMBOLS);
  const result = generator.generate({
    style: "story", vocabulary: "expanded", separator: "-", length: 16,
    capitalize: true, includeNumber: true, includeSymbol: true,
  });
  assert.equal(result.value.length, 16);
  assert.equal(result.kind, "sentence");
});

test("story templates count different word sequences", () => {
  const html = readPage("password-generator/index.html");
  const module = { exports: {} };
  runInNewContext(readInlineBlock(html, "script"), { module });
  const { LEXICON, PhrasePlanner } = module.exports;
  const planner = new PhrasePlanner(LEXICON);
  for (const vocabulary of Object.keys(LEXICON)) {
    const { story, compact } = planner.collection(vocabulary);
    const spaces = [...story, ...compact];
    const wordSets = spaces.map((space) => space.pools.map((pool) => new Set(pool.words)));
    for (let first = 0; first < wordSets.length; first++) {
      for (let second = first + 1; second < wordSets.length; second++) {
        const left = wordSets[first];
        const right = wordSets[second];
        if (left.length !== right.length) continue;
        const disjoint = left.some((words, index) =>
          [...words].every((word) => !right[index].has(word)),
        );
        assert.ok(disjoint, `Story templates ${first} and ${second} overlap for ${vocabulary}`);
      }
    }
  }
});

test("word modes offer more outcomes at the original 16-character setting", () => {
  const html = readPage("password-generator/index.html");
  const module = { exports: {} };
  runInNewContext(readInlineBlock(html, "script"), { module });
  const { LEXICON, SYMBOLS, CryptoRandom, PhrasePlanner, PassphrasePolicy, PassphraseGenerator } = module.exports;
  const generator = new PassphraseGenerator(new CryptoRandom(webcrypto), new PhrasePlanner(LEXICON), new PassphrasePolicy(), SYMBOLS);
  const originalCounts = { story: 9354648000n, random: 38590101379468800n };
  for (const style of ["story", "random"]) {
    const result = generator.generate({
      style, vocabulary: "expanded", separator: "-", length: 16,
      capitalize: true, includeNumber: true, includeSymbol: true,
    });
    assert.ok(result.combinations > originalCounts[style], style);
  }
});

function openRouter(search) {
  const links = [];
  const frame = {
    url: null,
    contentWindow: { location: { replace: (url) => { frame.url = url; } } },
  };
  const location = new URL(search, "https://example.test/web-utilities/");
  const history = [];
  const script = readInlineBlock(readPage("index.html"), "script");
  const document = {
    baseURI: location.href,
    getElementById: (id) => ({
      "tool-list": { append: (link) => links.push(link) },
      "tool-frame": frame,
    })[id],
    createElement: () => {
      const link = new EventTarget();
      link.attributes = new Map();
      link.setAttribute = (name, value) => link.attributes.set(name, value);
      link.removeAttribute = (name) => link.attributes.delete(name);
      return link;
    },
  };
  runInNewContext(script, {
    URL, URLSearchParams, document, location,
    history: {
      pushState: (_state, _title, url) => {
        history.push(String(url));
        location.href = String(url);
      },
    },
    window: new EventTarget(),
  });
  return { links, frame, history };
}

test("root, direct and unrecognized tool URLs load the generator under the project path", () => {
  for (const search of ["", "?tool=", "?tool=missing", "?tool=constructor", "?tool=password-generator"]) {
    const { links, frame, history } = openRouter(search);
    assert.equal(frame.url, "https://example.test/web-utilities/password-generator/index.html");
    assert.equal(frame.title, "Password Generator");
    assert.equal(links[0].attributes.get("aria-current"), "page");
    assert.equal(links[0].href, "https://example.test/web-utilities/?tool=password-generator");
    assert.equal(history.length, 0);
  }
});

test("the sidebar creates a shareable route and a single history entry", () => {
  const { links, history } = openRouter("?source=check");
  for (let click = 0; click < 2; click += 1) {
    const event = new Event("click", { cancelable: true });
    event.button = 0;
    assert.equal(links[0].dispatchEvent(event), false);
  }
  assert.deepEqual(history, [
    "https://example.test/web-utilities/?source=check&tool=password-generator",
  ]);
});
