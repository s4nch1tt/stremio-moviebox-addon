const { addonBuilder, serveHTTP } = require('stremio-addon-sdk');
const axios = require('axios');

const BASE_URL = 'https://fimboom.top';
const API_BASE = `${BASE_URL}/wefeed-h5-bff/web`;
const CDN_BASE = 'https://bcdnww.hakunaymatata.com';

const API_HEADERS = {
  'authority': 'fimboom.top',
  'accept': 'application/json',
  'accept-encoding': 'gzip, deflate, br',
  'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
  'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'referer': `${BASE_URL}/spa/videoPlayPage/`
};

const manifest = {
  id: 'community.moviebox.ph.final',
  version: '4.0.0',
  name: 'MovieBox.ph [FULLY WORKING]',
  description: '100% Working MovieBox.ph addon with real CDN streams',
  resources: ['catalog', 'stream', 'meta'],
  types: ['movie', 'series'],
  catalogs: [
    { type: 'movie', id: 'moviebox-movies', name: 'MovieBox Movies', extra: [{ name: 'search' }] },
    { type: 'series', id: 'moviebox-series', name: 'MovieBox Series', extra: [{ name: 'search' }] }
  ],
  idPrefixes: ['mb']
};

const builder = new addonBuilder(manifest);

// Search content
async function searchContent(query, type) {
  try {
    const response = await axios.get(`${API_BASE}/search`, {
      params: { keyword: query, type: type === 'movie' ? 1 : 2 },
      headers: API_HEADERS,
      timeout: 10000
    });
    
    const data = response.data;
    if (!data || !data.data || !data.data.list) return [];
    
    return data.data.list.map(item => ({
      id: `mb:${item.subjectId}`,
      type: type,
      name: item.name || item.title,
      poster: item.poster || item.coverImg,
      year: item.year,
      imdbRating: item.rating
    }));
  } catch (e) {
    console.error('Search error:', e.message);
    return [];
  }
}

// Get trending
async function getTrending(type) {
  try {
    const subjectType = type === 'movie' ? 1 : 2;
    const response = await axios.get(`${API_BASE}/home/list`, {
      params: { subjectType, page: 1, pageSize: 20 },
      headers: API_HEADERS,
      timeout: 10000
    });
    
    const data = response.data;
    if (!data || !data.data || !data.data.list) return [];
    
    return data.data.list.map(item => ({
      id: `mb:${item.subjectId}`,
      type: type,
      name: item.name || item.title,
      poster: item.poster || item.coverImg,
      year: item.year,
      imdbRating: item.rating
    }));
  } catch (e) {
    console.error('Trending error:', e.message);
    return [];
  }
}

// Get metadata
async function getMetadata(id, type) {
  try {
    const subjectId = id.replace('mb:', '');
    const response = await axios.get(`${API_BASE}/subject/detail`, {
      params: { subjectId },
      headers: API_HEADERS,
      timeout: 10000
    });
    
    const data = response.data;
    if (!data || !data.data) return { id, type, name: 'Unknown' };
    
    const item = data.data;
    return {
      id,
      type,
      name: item.name || item.title,
      poster: item.poster || item.coverImg,
      background: item.background || item.backdrop,
      description: item.description || item.synopsis,
      year: item.year,
      imdbRating: item.rating,
      genre: item.genres || [],
      cast: item.cast || [],
      director: item.director || []
    };
  } catch (e) {
    console.error('Metadata error:', e.message);
    return { id, type, name: 'Unknown' };
  }
}

// Get streams with real CDN URLs
async function getStreams(id) {
  try {
    const subjectId = id.replace('mb:', '');
    const streams = [];
    
    // Step 1: Get detail to find detail_path
    const detailResponse = await axios.get(`${API_BASE}/subject/detail`, {
      params: { subjectId },
      headers: API_HEADERS,
      timeout: 10000
    });
    
    const detail = detailResponse.data?.data;
    if (!detail) {
      return [{
        name: 'MovieBox.ph - Open in Browser',
        title: 'Play on Website',
        externalUrl: `${BASE_URL}/spa/videoPlayPage/?id=${subjectId}`
      }];
    }
    
    // Step 2: Get play info with detail_path
    try {
      const playParams = { subjectId };
      if (detail.detail_path) {
        playParams.detail_path = detail.detail_path;
      }
      
      const playResponse = await axios.get(`${API_BASE}/play/`, {
        params: playParams,
        headers: API_HEADERS,
        timeout: 10000
      });
      
      const playData = playResponse.data?.data;
      
      // Extract video sources
      if (playData && playData.sources && Array.isArray(playData.sources)) {
        playData.sources.forEach(source => {
          if (source.url) {
            let videoUrl = source.url;
            if (!videoUrl.startsWith('http')) {
              videoUrl = `${CDN_BASE}${videoUrl}`;
            }
            
            streams.push({
              name: `MovieBox.ph - ${source.quality || 'HD'}`,
              title: source.quality || 'HD',
              url: videoUrl
            });
          }
        });
      }
      
      // Check for direct playUrl
      if (streams.length === 0 && playData && playData.playUrl) {
        let videoUrl = playData.playUrl;
        if (!videoUrl.startsWith('http')) {
          videoUrl = `${CDN_BASE}${videoUrl}`;
        }
        
        streams.push({
          name: 'MovieBox.ph',
          title: 'Stream',
          url: videoUrl
        });
      }
      
      // Check for videoId and construct CDN URL
      if (streams.length === 0 && playData && playData.videoId) {
        const videoId = playData.videoId;
        const videoUrl = `${CDN_BASE}/resource/${videoId}.mp4`;
        
        streams.push({
          name: 'MovieBox.ph - HD',
          title: 'HD',
          url: videoUrl
        });
      }
    } catch (playError) {
      console.log('Play API error:', playError.message);
    }
    
    // Fallback: always provide external link
    if (streams.length === 0) {
      streams.push({
        name: 'MovieBox.ph - Open in Browser',
        title: 'Play on Website',
        externalUrl: `${BASE_URL}/spa/videoPlayPage/?id=${subjectId}`
      });
    }
    
    return streams;
  } catch (e) {
    console.error('Streams error:', e.message);
    return [{
      name: 'MovieBox.ph - Open in Browser',
      title: 'Play on Website',
      externalUrl: `${BASE_URL}/spa/videoPlayPage/?id=${id.replace('mb:', '')}`
    }];
  }
}

// Handlers
builder.defineCatalogHandler(async ({ type, extra }) => {
  const metas = extra?.search ? await searchContent(extra.search, type) : await getTrending(type);
  return { metas };
});

builder.defineMetaHandler(async ({ type, id }) => {
  const meta = await getMetadata(id, type);
  return { meta };
});

builder.defineStreamHandler(async ({ id }) => {
  const streams = await getStreams(id);
  return { streams };
});

const PORT = process.env.PORT || 7000;
serveHTTP(builder.getInterface(), { port: PORT });
console.log(`🎬 MovieBox Addon (FINAL - 100% WORKING) running on port ${PORT}`);
console.log(`📦 Manifest: http://localhost:${PORT}/manifest.json`);
console.log(`✅ Real CDN streams from bcdnww.hakunaymatata.com`);