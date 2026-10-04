within ForLoopErrors;
block Broadcast "A scalar source into every element: no wholesale form"
  parameter Integer n = 2;
  Buildings.Controls.OBC.CDL.Interfaces.RealInput u[n];
  Buildings.Controls.OBC.CDL.Interfaces.RealOutput y[n];
  Buildings.Controls.OBC.CDL.Reals.Sources.Constant con(k=1);
  Buildings.Controls.OBC.CDL.Reals.MultiplyByParameter gai[n](each k=2);
equation
  for i in 1:n loop
    connect(con.y, gai[i].u);
    connect(gai[i].y, y[i]);
  end for;
end Broadcast;
