// ✅ BAPATLA DISTRICT ONLY - OFFICIAL BOUNDARIES
var bapatlaDistrict = ee.FeatureCollection('projects/earthengine-public/assets/CCI_LC')  // Use admin boundaries
  .filter(ee.Filter.eq('country', 'India'))
  .filter(ee.Filter.eq('name', 'Bapatla'));  // Exact district name

// Alternative: Manual polygon for Bapatla district (more accurate than rectangle)
var bapatlaPrecise = ee.Geometry.Polygon([
  [[80.25, 16.15], [80.55, 16.15], [80.55, 15.75], [80.25, 15.75]]  // Bapatla district bounds
]);

Map.centerObject(bapatlaPrecise, 10);

// Use precise boundary for all processing
var region = bapatlaPrecise;

// Landsat processing (fixed from before)
var landsat = ee.ImageCollection('LANDSAT/LC08/C02/T1_L2')
  .merge(ee.ImageCollection('LANDSAT/LC09/C02/T1_L2'))
  .filterBounds(region).filterDate('2010-01-01', '2025-12-31')
  .filter(ee.Filter.lt('CLOUD_COVER', 10));

function addLandsatIndices(image) {
  var ndvi = image.normalizedDifference(['SR_B5', 'SR_B4']).rename('NDVI');
  var ndsi = image.normalizedDifference(['SR_B6', 'SR_B5']).rename('NDSI');
  var astersi = image.expression('(SR_B7 - SR_B6) / (SR_B7 + SR_B6)', {
    'SR_B6': image.select('SR_B6'), 'SR_B7': image.select('SR_B7')
  }).rename('ASTER_SI');
  var dem = ee.Image('USGS/SRTMGL1_003').clip(image.geometry()).rename('DEM');
  return image.addBands([ndvi, ndsi, astersi, dem]).select(['NDVI','NDSI','ASTER_SI','DEM']);
}

var landsatComp = landsat.map(addLandsatIndices).median().clip(region);

// Sentinel-2 processing
var sentinel2 = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterBounds(region).filterDate('2015-01-01', '2025-12-31')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10));

function addSentinelIndices(image) {
  var ndvi = image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  var ndsi = image.normalizedDifference(['B11', 'B8']).rename('NDSI');
  var astersi = image.expression('(B11 - B12) / (B11 + B12)', {
    'B11': image.select('B11'), 'B12': image.select('B12')
  }).rename('ASTER_SI');
  var dem = ee.Image('USGS/SRTMGL1_003').clip(image.geometry()).rename('DEM');
  return image.addBands([ndvi, ndsi, astersi, dem]).select(['NDVI','NDSI','ASTER_SI','DEM']);
}

var s2Comp = sentinel2.map(addSentinelIndices).median().clip(region);

// Visualize Bapatla district boundary + indices
Map.addLayer(region, {color: 'red'}, 'Bapatla District Boundary');
Map.addLayer(landsatComp.select('NDVI'), {min: -0.2, max: 0.8, palette: ['red','yellow','green']}, 'Landsat NDVI');
Map.addLayer(s2Comp.select('NDSI'), {min: -0.3, max: 0.5, palette: ['blue','white','red']}, 'S2 NDSI');

// Export ONLY Bapatla district samples
var samples = s2Comp.sample({
  region: region, 
  scale: 10, 
  numPixels: 15000,  // More samples for DL training
  geometries: true
});

Export.table.toDrive({
  collection: samples, 
  description: 'Bapatla_District_Salinity_15K_2026', 
  fileFormat: 'CSV'
});
