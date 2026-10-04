within FromModelica;
block PassthroughEquation
  "An output set equal to an input is a connection"
  parameter Real k = 1 "A parameter, not a connector";
  Buildings.Controls.OBC.CDL.Interfaces.RealInput u
    "Input";
  Buildings.Controls.OBC.CDL.Interfaces.RealOutput y
    "Output through a block";
  Buildings.Controls.OBC.CDL.Interfaces.RealOutput yInAct
    "Output equal to the input";
  Buildings.Controls.OBC.CDL.Reals.Abs abs1
    "A block";
equation
  connect(u, abs1.u);
  connect(abs1.y, y);
  yInAct = u;
end PassthroughEquation;
