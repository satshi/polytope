# JSON data format for 4D polytopes

## Elements

### vertices

A list of vertex coordinates. This field is mandatory.

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

A list of faces. This field is mandatory. Each face is a list of vertex indices.  Vertex numbering is zero-based.  Two neighboring vertices must be connected by an edge.  The orientation is arbitrary.

```
"faces":[
    [Integer, Integer, Integer, Integer, ...],
    [Integer, Integer, Integer, Integer, ...],
    [Integer, Integer, Integer, Integer, ...],
    ...
],
```

### facetCenters

A list of facet center coordinates.  This field is mandatory.

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

A list of vertex indices that belong to each facet. This field is optional.  Vertex numbering is zero-based.  This data helps the viewer start faster.

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

A list of face indices that belong to each facet. This field is optional.  Face numbering is zero-based.  This data helps the viewer start faster.

```
"facetToFace":[
    [Integer, Integer, Integer, Integer],
    [Integer, Integer, Integer, Integer],
    [Integer, Integer, Integer, Integer],
    [Integer, Integer, Integer, Integer],
    ...
],
```
