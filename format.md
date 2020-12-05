# JSON data format for 4D polytopes

## Elements

### vertices

List of the coordinates of the vertices. This is mandatory.

```
"vertices":[
    [Float, Float, Float, Float],
    [Float, Float, Float, Float],
    [Float, Float, Float, Float],
    [Float, Float, Float, Float],
    ...
],
```


### faces

List of the faces. This is mandatory. A face is expressed by a list of indices of vertices.  The numbering of vertices is zero-based.  Neighboring vertices are connected by edges.  The orientation is arbitrary.

```
"faces":[
    [Integer, Integer, Integer, Integer, ...],
    [Integer, Integer, Integer, Integer, ...],
    [Integer, Integer, Integer, Integer, ...],
    ...
],
```

### facetCenters

List of the coordinates of the facets.  This is mandatory.

```
"facetCenters":[
    [Float, Float, Float, Float],
    [Float, Float, Float, Float],
    [Float, Float, Float, Float],
    [Float, Float, Float, Float],
    ...
],
```

### facetToVertex

List of the indices of vertices which belongs to each facet. This is optional.  The numbering of vertices is zero-based.  These data help to start up quickly.

```
"facetToVertex":[
    [Integer, Integer, Integer, Integer],
    [Integer, Integer, Integer, Integer],
    [Integer, Integer, Integer, Integer],
    [Integer, Integer, Integer, Integer],
    ...
],
```

### facetToFace

List of the indices of faces which belongs to each facet. This is optional.  The numbering of faces is zero-based.  These data help to start up quickly.

```
"facetToFace":[
    [Integer, Integer, Integer, Integer],
    [Integer, Integer, Integer, Integer],
    [Integer, Integer, Integer, Integer],
    [Integer, Integer, Integer, Integer],
    ...
],
```
