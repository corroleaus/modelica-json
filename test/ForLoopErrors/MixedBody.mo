within ForLoopErrors;
block MixedBody "A loop with connects and a non-connect equation: not an error"
  parameter Integer n = 2;
  Buildings.Controls.OBC.CDL.Interfaces.RealInput u[n];
  Buildings.Controls.OBC.CDL.Interfaces.RealOutput y[n];
  Buildings.Controls.OBC.CDL.Reals.Sources.Constant con(k=1);
  Buildings.Controls.OBC.CDL.Reals.MultiplyByParameter gai[n](each k=2);
equation
  for i in 1:n loop
    connect(u[i], gai[i].u);
    connect(gai[i].y, y[i]);
    assert(n > 0, "n must be positive");
  end for;
end MixedBody;
