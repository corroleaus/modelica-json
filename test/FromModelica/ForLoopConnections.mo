within FromModelica;
block ForLoopConnections
  "for-loop connects that cover a whole array map to wholesale connections"
  parameter Integer n = 2 "Array size";
  Buildings.Controls.OBC.CDL.Interfaces.RealInput u[n]
    "Connector array into an instance array";
  Buildings.Controls.OBC.CDL.Interfaces.RealOutput y[n]
    "Connector array out of an instance array";
  Buildings.Controls.OBC.CDL.Interfaces.RealOutput ySum
    "Sum of the vector port";
  Buildings.Controls.OBC.CDL.Reals.MultiplyByParameter gai[n](each k=2)
    "Instance array";
  Buildings.Controls.OBC.CDL.Reals.Abs abs1[n]
    "Second instance array";
  Buildings.Controls.OBC.CDL.Reals.MultiSum mulSum(nin=n)
    "Scalar instance with a vector port";
  Buildings.Controls.OBC.CDL.Reals.Sources.Constant con[n-1](each k=1)
    "Array sized by an expression";
  Buildings.Controls.OBC.CDL.Reals.Abs abs2[n-1]
    "Array sized by the same expression";
  Buildings.Controls.OBC.CDL.Reals.Sources.Constant zero(k=0)
    "Scalar source fanned out by a literal-size loop";
  Buildings.Controls.OBC.CDL.Reals.Abs lit[3]
    "Literal-size array: the fan-out unrolls to three element edges";
equation
  for i in 1:n loop
    connect(u[i], gai[i].u);
    connect(gai[i].y, abs1[i].u);
    connect(abs1[i].y, y[i]);
    connect(abs1[i].y, mulSum.u[i]);
  end for;
  for i in 1:n-1 loop
    connect(con[i].y, abs2[i].u);
  end for;
  for i in 1:3 loop
    connect(zero.y, lit[i].u);
  end for;
  connect(mulSum.y, ySum);
end ForLoopConnections;
