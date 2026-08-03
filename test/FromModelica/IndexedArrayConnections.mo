within FromModelica;
block IndexedArrayConnections
  "Indexed array references in connect statements"

  Buildings.Controls.OBC.CDL.Reals.Sources.Constant con[2,3](each k=1)
    "Array of scalar sources";
  Buildings.Controls.OBC.CDL.Interfaces.RealInput u[3]
    "Vector input connected from an array slice";
  Buildings.Controls.OBC.CDL.Interfaces.RealInput uSca
    "Scalar input connected from an indexed source";
  Buildings.Controls.OBC.CDL.Interfaces.RealInput uDir[3]
    "Vector input connected by an indexed connector";
  Buildings.Controls.OBC.CDL.Interfaces.RealOutput yDir[3]
    "Vector output connected by an indexed connector";

equation
  connect(con[2,3].y, uSca);
  connect(con[1, :].y, u);
  connect(yDir[2], uDir[1]);
end IndexedArrayConnections;
