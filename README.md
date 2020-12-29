# 4D Polytope Viewer

This is 4D Polytope Viewer written by typescript and three.js. You can see most 4D convex uniform polytopes and rotate them.

[![A screenshot](img/screenshot.jpeg "A screenshot")](https://youtu.be/hjcY2zeuUDM)

## Getting started

1. [Go to here.](https://satshi.github.io/app/)
2. Push the "View" button.

Then you will see a rotating 4D cube.

## What is next?

### Control

By pushing buttons in the "Control" section, you can change the control mode.

* Auto: It rotates automatically.
* Stop: It stops.
* 3D move: You can rotate in three-dimensional space by dragging the mouse.
* 4D move: You can rotate in four-dimensional space by dragging the mouse.

### Choose another polytope

1. Select a polytope class from the drop-down list on the left.
2. Select a polytope from the drop-down list on the right.
3. Push the "View" button.

Then you will see the polytope.

### Frame view

If you check the checkbox of "Frame" and press the "View" button, the polytope will be displayed in frame mode.

## About polytopes
Wikipedia page [Uniform 4-polytope](https://en.wikipedia.org/wiki/Uniform_4-polytope) includes a nice explanation.  The name of polytopes in "**-cell series" in this app are based on Coxeter diagrams. 0 in this app corresponds to ● in the Coxeter diagram and 1 corresponds to ◉. Thus, for example, 0101 in this app corresponds to Coxeter diagram ●－◉－●－◉.  "Snub" in this app corresponds to ◯－◯－◯－◯.


## Other information

[JSON data format for polytopes](format.md)