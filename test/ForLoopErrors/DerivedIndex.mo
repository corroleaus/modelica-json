within ForLoopErrors;
block DerivedIndex "A subscript computed from the loop index"
  parameter Integer n = 2;
  Buildings.Controls.OBC.CDL.Interfaces.RealInput u[n];
  Buildings.Controls.OBC.CDL.Interfaces.RealOutput y[n];
  Buildings.Controls.OBC.CDL.Reals.Sources.Constant con(k=1);
  Buildings.Controls.OBC.CDL.Reals.MultiplyByParameter gai[n](each k=2);
equation
  for i in 1:n loop
    connect(u[i], gai[n-i+1].u);
  end for;
end DerivedIndex;
