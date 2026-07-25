# JSON data format for 4D polytopes

## Elements

### vertices

A non-empty list of vertex coordinates. This field is mandatory. Each vertex must contain exactly four finite JSON numbers.

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

A non-empty list of faces. This field is mandatory. Each face contains at least three distinct, valid vertex indices. Vertex numbering is zero-based. Two neighboring vertices must be connected by an edge. The orientation is arbitrary.

```
"faces":[
    [Integer, Integer, Integer, Integer, ...],
    [Integer, Integer, Integer, Integer, ...],
    [Integer, Integer, Integer, Integer, ...],
    ...
],
```

### facetCenters

A non-empty list of facet center coordinates. This field is mandatory. Each center must contain exactly four finite JSON numbers.

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

A list of vertex indices that belong to each facet. This field is optional. When present, it must contain one non-empty entry per facet and only distinct, valid indices. Vertex numbering is zero-based. This data helps the viewer start faster.

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

A list of face indices that belong to each facet. This field is optional. When present, it must contain one non-empty entry per facet and only distinct, valid indices. Face numbering is zero-based. This data helps the viewer start faster.

```
"facetToFace":[
    [Integer, Integer, Integer, Integer],
    [Integer, Integer, Integer, Integer],
    [Integer, Integer, Integer, Integer],
    [Integer, Integer, Integer, Integer],
    ...
],
```
